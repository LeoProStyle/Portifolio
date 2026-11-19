"""Corretora SIMULADA de minicontratos (WIN/WDO) — somente paper trading (regra 1).

Diferenças em relação às ações (PaperBroker):
- o caixa NÃO paga o valor do contrato: só recebe/paga o resultado em pontos
  (saída − entrada) × quantidade × multiplicador e os custos fixos por contrato;
- a posição pode ser negativa (vendido a descoberto);
- abrir posição consome MARGEM (por contrato); fechar é sempre permitido;
- slippage em pontos, sempre contra quem opera; contratos inteiros;
- stop e alvo valem para os dois lados (vendido: stop acima, alvo abaixo).

Reaproveita a persistência do PaperBroker (ordens, cursor, histórico de patrimônio).
"""

import uuid
from dataclasses import dataclass

import pandas as pd
from sqlalchemy import Engine, insert, select

from app.broker.base import Fill, PortfolioSnapshot, PositionView, Side
from app.broker.paper import PaperBroker, _Position, _ts
from app.db.models import orders


@dataclass(frozen=True)
class ContractSpec:
    multiplier: float  # R$ por ponto por contrato
    fee_per_contract: float
    margin_per_contract: float
    slippage_points: float = 0.0


def _sign(side: Side) -> int:
    return 1 if side == "COMPRA" else -1


class FuturesBroker(PaperBroker):
    def __init__(
        self,
        engine: Engine,
        initial_cash: float,
        spec: ContractSpec | dict[str, ContractSpec],
        account_id: str,
    ) -> None:
        # um contrato (robô de um ativo) ou um por ativo (rastreador: WIN ≠ WDO)
        self._specs: dict[str, ContractSpec] = spec if isinstance(spec, dict) else {}
        self.spec = spec if isinstance(spec, ContractSpec) else next(iter(spec.values()))
        super().__init__(
            engine, initial_cash=initial_cash, fee_pct=0.0, slippage_pct=0.0, account_id=account_id
        )

    def spec_for(self, ticker: str) -> ContractSpec:
        return self._specs.get(ticker, self.spec)

    # ---------- estado ----------

    def _rebuild(self) -> None:
        """Caixa e posições a partir das ordens executadas (sobrevive a reiniciar)."""
        self._cash = self._initial_cash
        self._positions = {}
        stmt = (
            select(orders)
            .where(orders.c.account_id == self.account_id, orders.c.status == "filled")
            .order_by(orders.c.filled_ts, orders.c.created_ts)
        )
        with self._engine.connect() as conn:
            for row in conn.execute(stmt).mappings():
                held = self.position_qty(row["ticker"])
                # stop/alvo só de ordens que ABRIRAM ou aumentaram a posição (igual ao vivo)
                opening = held == 0 or (held > 0) == (row["side"] == "COMPRA")
                self._apply_fill(
                    row["ticker"], row["side"], row["filled_qty"], row["fill_price"], row["fee"]
                )
                if row["reason"] == "decisao" and opening:
                    self._set_exits(row["ticker"], row["stop"], row["target"])

    def _apply_fill(self, ticker: str, side: str, qty: int, price: float, fee: float) -> None:
        pos = self._positions.setdefault(ticker, _Position())
        delta = qty * (1 if side == "COMPRA" else -1)
        self._cash -= fee
        if pos.qty == 0 or (pos.qty > 0) == (delta > 0):
            # abre ou aumenta no mesmo lado: preço médio ponderado
            total = pos.avg_price * abs(pos.qty) + price * abs(delta)
            pos.qty += delta
            pos.avg_price = total / abs(pos.qty)
        else:
            # reduz/zera: realiza o resultado em pontos (nunca vira a mão, ver _fill_pending)
            closed = min(abs(delta), abs(pos.qty))
            direction = 1 if pos.qty > 0 else -1
            self._cash += (
                (price - pos.avg_price) * closed * self.spec_for(ticker).multiplier * direction
            )
            pos.qty += delta
        if pos.qty == 0:
            del self._positions[ticker]

    # ---------- consultas ----------

    def margin_used(self) -> float:
        return sum(
            abs(p.qty) * self.spec_for(t).margin_per_contract for t, p in self._positions.items()
        )

    def exposure(self, ticker: str) -> float:
        pos = self._positions.get(ticker)
        return abs(pos.qty) * self.spec_for(ticker).margin_per_contract if pos else 0.0

    def portfolio(self, marks: dict[str, float]) -> PortfolioSnapshot:
        views = []
        unrealized = 0.0
        for ticker, pos in sorted(self._positions.items()):
            mark = marks.get(ticker, pos.avg_price)
            mult = self.spec_for(ticker).multiplier
            pnl = (mark - pos.avg_price) * pos.qty * mult
            unrealized += pnl
            views.append(
                PositionView(
                    ticker=ticker,
                    qty=pos.qty,
                    avg_price=round(pos.avg_price, 4),
                    stop=pos.stop,
                    mark=mark,
                    # valor de referência (nocional) do contrato; não entra no patrimônio
                    value=round(mark * pos.qty * mult, 2),
                    pnl=round(pnl, 2),
                )
            )
        return PortfolioSnapshot(
            cash=round(self._cash, 2),
            equity=round(self._cash + unrealized, 2),
            initial_cash=self._initial_cash,
            positions=views,
        )

    # ---------- execução ----------

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
        spec = self.spec_for(ticker)
        for row in pending:
            side: Side = row["side"]
            price = open_ + spec.slippage_points * _sign(side)
            qty = int(row["qty"])
            held = self.position_qty(ticker)
            note = ""
            closing = held != 0 and (held > 0) != (side == "COMPRA")
            # ordem de zerar (sem stop) só vale contra a posição; abrir só a partir de zerado
            if row["stop"] is None and not closing:
                self._finish(row["id"], "rejected", ts, None, None, None, "nada a zerar")
                continue
            if row["stop"] is not None and held != 0:
                note = f"já há posição de {held}: abertura só a partir de zerado"
                self._finish(row["id"], "rejected", ts, None, None, None, note)
                continue
            if closing:
                if qty > abs(held):  # sem virar a mão numa ordem só
                    note = f"posição de {held}: quantidade reduzida de {qty} para {abs(held)}"
                    qty = abs(held)
            else:
                equity = self.portfolio({ticker: open_}).equity
                free = equity - self.margin_used()
                per = spec.margin_per_contract + spec.fee_per_contract
                affordable = max(0, int(free // per))
                if affordable < qty:
                    note = f"margem insuficiente: quantidade reduzida de {qty} para {affordable}"
                    qty = affordable
            if qty <= 0:
                self._finish(row["id"], "rejected", ts, None, None, None, note or "nada a executar")
                continue
            fee = spec.fee_per_contract * qty
            self._apply_fill(ticker, side, qty, price, fee)
            if not closing:
                self._set_exits(ticker, row["stop"], row["target"])
            self._finish(row["id"], "filled", ts, qty, price, fee, note)
            fills.append(Fill(row["id"], ticker, side, qty, price, fee, ts, row["reason"]))
        return fills

    def _set_exits(self, ticker: str, stop: float | None, target: float | None) -> None:
        pos = self._positions.get(ticker)
        if pos is None:
            return
        # o stop só se aproxima do preço: sobe no comprado, desce no vendido
        if stop is not None:
            closer = pos.stop is None or (stop > pos.stop if pos.qty > 0 else stop < pos.stop)
            if closer:
                pos.stop = stop
        if target is not None:
            pos.target = target

    def _check_exits(
        self, ticker: str, ts: pd.Timestamp, open_: float, low: float, high: float
    ) -> Fill | None:
        """Stop primeiro (conservador), depois o alvo; gap além do nível sai na abertura."""
        pos = self._positions.get(ticker)
        if pos is None:
            return None
        if pos.qty > 0:
            if pos.stop is not None and low <= pos.stop:
                note = f"stop em {pos.stop:.2f} atingido (mínima {low:.2f})"
                return self._exit(ticker, ts, min(open_, pos.stop), "stop", note)
            if pos.target is not None and high >= pos.target:
                note = f"alvo em {pos.target:.2f} atingido (máxima {high:.2f})"
                return self._exit(ticker, ts, max(open_, pos.target), "alvo", note)
            return None
        if pos.stop is not None and high >= pos.stop:
            note = f"stop do vendido em {pos.stop:.2f} atingido (máxima {high:.2f})"
            return self._exit(ticker, ts, max(open_, pos.stop), "stop", note)
        if pos.target is not None and low <= pos.target:
            note = f"alvo do vendido em {pos.target:.2f} atingido (mínima {low:.2f})"
            return self._exit(ticker, ts, min(open_, pos.target), "alvo", note)
        return None

    def _exit(self, ticker: str, ts: pd.Timestamp, base: float, reason: str, note: str) -> Fill:
        pos = self._positions[ticker]
        side: Side = "VENDA" if pos.qty > 0 else "COMPRA"
        spec = self.spec_for(ticker)
        price = base + spec.slippage_points * _sign(side)
        qty = abs(pos.qty)
        fee = spec.fee_per_contract * qty
        order_id = str(uuid.uuid4())
        with self._engine.begin() as conn:
            conn.execute(
                insert(orders).values(
                    account_id=self.account_id,
                    id=order_id,
                    cycle_id=None,
                    ticker=ticker,
                    side=side,
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
        self._apply_fill(ticker, side, qty, price, fee)
        return Fill(order_id, ticker, side, qty, price, fee, ts, reason)
