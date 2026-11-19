"""PaperBroker: corretora simulada (seção 7).

- Execução na ABERTURA do primeiro candle que abriu depois da ordem
  (nunca no preço que gerou o sinal).
- Slippage sempre contra: compra paga open × (1 + slip), venda recebe open × (1 − slip).
- Taxa = valor executado × fee_pct.
- Lote fracionário: 1 ação (simplificação documentada).
- Stops checados a cada candle novo; com gap, sai na abertura.
- Sem venda a descoberto: VENDA só até a quantidade em carteira.
- Tudo persistido no SQLite. Caixa e posições são reconstruídos a partir das
  ordens executadas, então o estado sobrevive a reinícios.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

import pandas as pd
from sqlalchemy import Engine, select, update
from sqlalchemy.dialects.sqlite import insert

from app.agents.risk_rules import floor_step
from app.broker.base import (
    Broker,
    Fill,
    Order,
    OrderStatus,
    PortfolioSnapshot,
    PositionView,
    Side,
)
from app.clock import TZ_BRASILIA
from app.db.models import broker_cursor, equity_history, orders


@dataclass
class _Position:
    qty: int = 0
    avg_price: float = 0.0
    stop: float | None = None
    target: float | None = None  # alvo (take-profit)


def _ts(dt: datetime | pd.Timestamp) -> int:
    return int(dt.timestamp())


def _dt(ts: int | None) -> datetime | None:
    return None if ts is None else datetime.fromtimestamp(ts, TZ_BRASILIA)


class PaperBroker(Broker):
    def __init__(
        self,
        engine: Engine,
        initial_cash: float,
        fee_pct: float,
        slippage_pct: float,
        account_id: str = "default",
        qty_step: float = 1.0,
    ) -> None:
        self._engine = engine
        # passo de quantidade: 1 = ações inteiras; 0,0001 = cripto fracionária
        self._qty_step = qty_step
        # cada robô tem sua conta (account_id = run_id); tudo é filtrado por ela
        self.account_id = account_id
        self._initial_cash = initial_cash
        self._fee_pct = fee_pct
        self._slip = slippage_pct
        self._cash = initial_cash
        self._positions: dict[str, _Position] = {}
        self._rebuild()

    # ---------- estado ----------

    def _rebuild(self) -> None:
        """Reconstrói caixa e posições a partir das ordens executadas."""
        self._cash = self._initial_cash
        self._positions = {}
        stmt = (
            select(orders)
            .where(orders.c.account_id == self.account_id, orders.c.status == "filled")
            .order_by(orders.c.filled_ts, orders.c.created_ts)
        )
        with self._engine.connect() as conn:
            for row in conn.execute(stmt).mappings():
                self._apply_fill(
                    row["ticker"], row["side"], row["filled_qty"], row["fill_price"], row["fee"]
                )
                if row["side"] == "COMPRA":
                    self._set_exits(row["ticker"], row["stop"], row["target"])

    def _apply_fill(self, ticker: str, side: str, qty: int, price: float, fee: float) -> None:
        pos = self._positions.setdefault(ticker, _Position())
        if side == "COMPRA":
            total = pos.avg_price * pos.qty + price * qty
            pos.qty += qty
            pos.avg_price = total / pos.qty
            self._cash -= price * qty + fee
        else:
            pos.qty -= qty
            self._cash += price * qty - fee
            if pos.qty == 0:
                del self._positions[ticker]

    # ---------- ordens ----------

    def submit_order(
        self,
        ticker: str,
        side: Side,
        qty: int,
        stop: float | None,
        at: datetime,
        cycle_id: str | None = None,
        target: float | None = None,
    ) -> Order:
        if qty <= 0:
            raise ValueError("Quantidade da ordem precisa ser positiva")
        if side not in ("COMPRA", "VENDA"):
            raise ValueError(f"Lado inválido: {side}")
        order_id = str(uuid.uuid4())
        with self._engine.begin() as conn:
            conn.execute(
                insert(orders).values(
                    account_id=self.account_id,
                    id=order_id,
                    cycle_id=cycle_id,
                    ticker=ticker,
                    side=side,
                    qty=qty,
                    stop=stop,
                    target=target,
                    reason="decisao",
                    status="pending",
                    created_ts=_ts(at),
                    note="",
                )
            )
        return self._get_order(order_id)

    def process_candles(self, ticker: str, candles: pd.DataFrame) -> list[Fill]:
        """Processa candles ainda não vistos: executa pendentes e checa stops."""
        if candles.empty:
            return []
        cursor = self._cursor(ticker)
        fills: list[Fill] = []
        for ts, candle in candles.sort_index().iterrows():
            candle_ts = _ts(ts)
            if cursor is not None and candle_ts <= cursor:
                continue
            fills.extend(self._fill_pending(ticker, ts, float(candle["open"])))
            exit_fill = self._check_exits(
                ticker, ts, float(candle["open"]), float(candle["low"]), float(candle["high"])
            )
            if exit_fill:
                fills.append(exit_fill)
            cursor = candle_ts
        if cursor is not None:
            self._save_cursor(ticker, cursor)
        return fills

    def _fill_pending(self, ticker: str, ts: pd.Timestamp, open_: float) -> list[Fill]:
        stmt = (
            select(orders)
            .where(
                orders.c.account_id == self.account_id,
                orders.c.ticker == ticker,
                orders.c.status == "pending",
                orders.c.created_ts <= _ts(ts),  # o candle abriu no instante da ordem ou depois
            )
            .order_by(orders.c.created_ts)
        )
        with self._engine.connect() as conn:
            pending = list(conn.execute(stmt).mappings())

        fills = []
        for row in pending:
            side: Side = row["side"]
            price = open_ * (1 + self._slip) if side == "COMPRA" else open_ * (1 - self._slip)
            qty = row["qty"]
            note = ""
            if side == "COMPRA":
                affordable = floor_step(self._cash / (price * (1 + self._fee_pct)), self._qty_step)
                if self._qty_step == 1:
                    affordable = int(affordable)
                if affordable < qty:
                    note = f"caixa insuficiente: quantidade reduzida de {qty} para {affordable}"
                    qty = affordable
            else:
                held = self.position_qty(ticker)
                if held < qty:
                    note = f"posição de {held}: quantidade reduzida de {qty}"
                    qty = held
            if qty <= 0:
                self._finish(row["id"], "rejected", ts, None, None, None, note or "nada a executar")
                continue
            fee = price * qty * self._fee_pct
            self._apply_fill(ticker, side, qty, price, fee)
            if side == "COMPRA":
                self._set_exits(ticker, row["stop"], row["target"])
            self._finish(row["id"], "filled", ts, qty, price, fee, note)
            fills.append(Fill(row["id"], ticker, side, qty, price, fee, ts, row["reason"]))
        return fills

    def _set_exits(self, ticker: str, stop: float | None, target: float | None) -> None:
        pos = self._positions.get(ticker)
        if pos is None:
            return
        # o stop nunca é afastado depois da entrada (só pode subir)
        if stop is not None and (pos.stop is None or stop > pos.stop):
            pos.stop = stop
        if target is not None:
            pos.target = target

    def _check_exits(
        self, ticker: str, ts: pd.Timestamp, open_: float, low: float, high: float
    ) -> Fill | None:
        """Stop e alvo. Se os dois forem tocados no mesmo candle, conta o stop (conservador)."""
        pos = self._positions.get(ticker)
        if pos is None:
            return None
        if pos.stop is not None and low <= pos.stop:
            base = min(open_, pos.stop)  # gap abaixo do stop: sai na abertura
            note = f"stop em {pos.stop:.2f} atingido (mínima {low:.2f})"
            return self._exit(ticker, ts, base, "stop", note)
        if pos.target is not None and high >= pos.target:
            base = max(open_, pos.target)  # gap acima do alvo: sai na abertura
            note = f"alvo em {pos.target:.2f} atingido (máxima {high:.2f})"
            return self._exit(ticker, ts, base, "alvo", note)
        return None

    def _exit(self, ticker: str, ts: pd.Timestamp, base: float, reason: str, note: str) -> Fill:
        pos = self._positions[ticker]
        price = base * (1 - self._slip)
        qty = pos.qty
        fee = price * qty * self._fee_pct
        order_id = str(uuid.uuid4())
        with self._engine.begin() as conn:
            conn.execute(
                insert(orders).values(
                    account_id=self.account_id,
                    id=order_id,
                    cycle_id=None,
                    ticker=ticker,
                    side="VENDA",
                    qty=qty,
                    stop=pos.stop,
                    target=pos.target,
                    reason=reason,
                    status="filled",
                    created_ts=_ts(ts),
                    filled_ts=_ts(ts),
                    filled_qty=qty,
                    fill_price=price,
                    fee=fee,
                    note=note,
                )
            )
        self._apply_fill(ticker, "VENDA", qty, price, fee)
        return Fill(order_id, ticker, "VENDA", qty, price, fee, ts, reason)

    def _finish(
        self,
        order_id: str,
        status: OrderStatus,
        ts: pd.Timestamp,
        qty: int | None,
        price: float | None,
        fee: float | None,
        note: str,
    ) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                update(orders)
                .where(orders.c.id == order_id)
                .values(
                    status=status,
                    filled_ts=_ts(ts),
                    filled_qty=qty,
                    fill_price=price,
                    fee=fee,
                    note=note,
                )
            )

    # ---------- cursor ----------

    def _cursor(self, ticker: str) -> int | None:
        with self._engine.connect() as conn:
            return conn.execute(
                select(broker_cursor.c.last_candle_ts).where(
                    broker_cursor.c.account_id == self.account_id,
                    broker_cursor.c.ticker == ticker,
                )
            ).scalar()

    def _save_cursor(self, ticker: str, ts: int) -> None:
        stmt = insert(broker_cursor).values(
            account_id=self.account_id, ticker=ticker, last_candle_ts=ts
        )
        with self._engine.begin() as conn:
            conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[broker_cursor.c.account_id, broker_cursor.c.ticker],
                    set_={"last_candle_ts": stmt.excluded.last_candle_ts},
                )
            )

    # ---------- consultas ----------

    def position_qty(self, ticker: str) -> int:
        pos = self._positions.get(ticker)
        return pos.qty if pos else 0

    @property
    def fee_pct(self) -> float:
        return self._fee_pct

    @property
    def slippage_pct(self) -> float:
        return self._slip

    @property
    def qty_step(self) -> float:
        return self._qty_step

    def has_pending(self, ticker: str) -> bool:
        """Há ordem esperando execução (o robô não deve repetir a ordem)."""
        return bool(self.list_orders(ticker=ticker, status="pending", limit=1))

    def exposure(self, ticker: str) -> float:
        """Capital alocado no ativo (custo da posição); usado pelo risco do escritório."""
        pos = self._positions.get(ticker)
        return pos.qty * pos.avg_price if pos else 0.0

    def active_tickers(self) -> set[str]:
        with self._engine.connect() as conn:
            pending = conn.execute(
                select(orders.c.ticker)
                .where(orders.c.account_id == self.account_id, orders.c.status == "pending")
                .distinct()
            ).scalars()
            return set(pending) | set(self._positions)

    def portfolio(self, marks: dict[str, float]) -> PortfolioSnapshot:
        views = []
        for ticker, pos in sorted(self._positions.items()):
            mark = marks.get(ticker, pos.avg_price)
            value = mark * pos.qty
            views.append(
                PositionView(
                    ticker=ticker,
                    qty=pos.qty,
                    avg_price=round(pos.avg_price, 4),
                    stop=pos.stop,
                    mark=mark,
                    value=round(value, 2),
                    pnl=round((mark - pos.avg_price) * pos.qty, 2),
                )
            )
        equity = self._cash + sum(v.value for v in views)
        return PortfolioSnapshot(
            cash=round(self._cash, 2),
            equity=round(equity, 2),
            initial_cash=self._initial_cash,
            positions=views,
        )

    def record_equity(self, at: datetime, marks: dict[str, float]) -> None:
        snap = self.portfolio(marks)
        stmt = insert(equity_history).values(
            account_id=self.account_id, ts=_ts(at), cash=snap.cash, equity=snap.equity
        )
        with self._engine.begin() as conn:
            conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[equity_history.c.account_id, equity_history.c.ts],
                    set_={"cash": stmt.excluded.cash, "equity": stmt.excluded.equity},
                )
            )

    def daily_pnl_pct(self, at: datetime, marks: dict[str, float]) -> float:
        """Variação do patrimônio desde o último registro ANTES do dia de `at`."""
        day_start = at.astimezone(TZ_BRASILIA).replace(hour=0, minute=0, second=0, microsecond=0)
        with self._engine.connect() as conn:
            base = conn.execute(
                select(equity_history.c.equity)
                .where(
                    equity_history.c.account_id == self.account_id,
                    equity_history.c.ts < _ts(day_start),
                )
                .order_by(equity_history.c.ts.desc())
                .limit(1)
            ).scalar()
        base = base if base else self._initial_cash
        return self.portfolio(marks).equity / base - 1

    def list_orders(
        self, ticker: str | None = None, status: OrderStatus | None = None, limit: int = 100
    ) -> list[Order]:
        stmt = select(orders).where(orders.c.account_id == self.account_id)
        if ticker:
            stmt = stmt.where(orders.c.ticker == ticker)
        if status:
            stmt = stmt.where(orders.c.status == status)
        stmt = stmt.order_by(orders.c.created_ts.desc(), orders.c.filled_ts.desc()).limit(limit)
        with self._engine.connect() as conn:
            return [self._to_order(r) for r in conn.execute(stmt).mappings()]

    def _get_order(self, order_id: str) -> Order:
        with self._engine.connect() as conn:
            row = conn.execute(select(orders).where(orders.c.id == order_id)).mappings().one()
        return self._to_order(row)

    @staticmethod
    def _to_order(r: object) -> Order:
        row = dict(r)  # type: ignore[call-overload]
        return Order(
            id=row["id"],
            cycle_id=row["cycle_id"],
            ticker=row["ticker"],
            side=row["side"],
            qty=row["qty"],
            stop=row["stop"],
            reason=row["reason"],
            status=row["status"],
            created_at=_dt(row["created_ts"]),  # type: ignore[arg-type]
            filled_at=_dt(row["filled_ts"]),
            filled_qty=row["filled_qty"],
            fill_price=row["fill_price"],
            fee=row["fee"],
            note=row["note"],
        )
