"""Risco do escritório (o Gerente Geral), sempre em código.

Bloqueia só ORDENS NOVAS de compra (posições, stops e alvos continuam) quando:
- o robô, a sala ou o prédio está pausado (pausa manual vale até "retomar");
- a perda do dia da sala ou do prédio atinge o limite → pausa automática até
  a meia-noite de Brasília;
- a exposição somada de todos os robôs da sala num ativo passaria do limite.
"""

from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy import Engine, delete, select
from sqlalchemy.dialects.sqlite import insert

from app.clock import TZ_BRASILIA
from app.db.models import equity_history, office_state
from app.office.accounts import AccountRegistry
from app.office.config import OfficeConfig

BUILDING = "building"


def robot_scope(robot_id: str) -> str:
    return f"robot:{robot_id}"


def _midnight_after(at: datetime) -> datetime:
    day = at.astimezone(TZ_BRASILIA).replace(hour=0, minute=0, second=0, microsecond=0)
    return day + timedelta(days=1)


def _brl_only(currency: str, at: datetime) -> float | None:
    return 1.0 if currency == "BRL" else None


class OfficeRisk:
    def __init__(
        self,
        engine: Engine,
        office: OfficeConfig,
        accounts: AccountRegistry,
        fx_rate: Callable[[str, datetime], float | None] = _brl_only,
    ) -> None:
        self._engine = engine
        self._office = office
        self._accounts = accounts
        # reais por unidade da moeda da sala no instante (cripto: USDBRL=X completo)
        self._fx_rate = fx_rate

    def rate(self, room: str, at: datetime) -> float | None:
        cfg = self._office.room(room)
        return self._fx_rate(cfg.currency if cfg else "BRL", at)

    def building_day_pnl(self, at: datetime) -> tuple[float, float, bool]:
        """(R$, %, faltou_cotação) do prédio. Mesma cotação no início e no fim do dia:
        mede o resultado dos robôs, não a variação do dólar."""
        start_ts = int((_midnight_after(at) - timedelta(days=1)).timestamp())
        base = now = 0.0
        missing = False
        for room in self._office.rooms:
            runs = self.room_runs(room.id, at)
            if not runs:
                continue
            rate = self.rate(room.id, at)
            if rate is None:
                missing = True
                continue
            base += sum(self.equity(r, start_ts) for r in runs) * rate
            now += sum(self.equity(r, None) for r in runs) * rate
        return now - base, (now / base - 1 if base else 0.0), missing

    # ---------- pausas ----------

    def pause(self, scope: str, reason: str, until: datetime | None = None) -> None:
        stmt = insert(office_state).values(
            scope=scope,
            paused=1,
            reason=reason,
            until_ts=int(until.timestamp()) if until else None,
        )
        with self._engine.begin() as conn:
            conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[office_state.c.scope],
                    set_={"paused": 1, "reason": reason, "until_ts": stmt.excluded.until_ts},
                )
            )

    def resume(self, scope: str) -> None:
        with self._engine.begin() as conn:
            conn.execute(delete(office_state).where(office_state.c.scope == scope))

    def status(self, scope: str, at: datetime) -> tuple[bool, str | None]:
        with self._engine.connect() as conn:
            row = (
                conn.execute(select(office_state).where(office_state.c.scope == scope))
                .mappings()
                .first()
            )
        if row is None or not row["paused"]:
            return False, None
        if row["until_ts"] is not None and row["until_ts"] <= int(at.timestamp()):
            return False, None  # pausa automática do dia já expirou
        return True, str(row["reason"])

    # ---------- números da sala/prédio ----------

    def room_runs(self, room: str, at: datetime) -> list[str]:
        return [
            self._accounts.live_run(r, at)
            for r in self._office.robots
            if r.room == room and r.enabled
        ]

    def equity(self, run_id: str, before_ts: int | None = None) -> float:
        stmt = select(equity_history.c.equity).where(equity_history.c.account_id == run_id)
        if before_ts is not None:
            stmt = stmt.where(equity_history.c.ts < before_ts)
        with self._engine.connect() as conn:
            value = conn.execute(stmt.order_by(equity_history.c.ts.desc()).limit(1)).scalar()
        if value is not None:
            return float(value)
        info = self._accounts.run_info(run_id)
        return float(info["initial_cash"]) if info else 0.0

    def day_pnl(self, run_ids: list[str], at: datetime) -> tuple[float, float]:
        """(R$, %) do dia: último patrimônio contra o de antes da meia-noite (BRT)."""
        start_ts = int((_midnight_after(at) - timedelta(days=1)).timestamp())
        base = sum(self.equity(r, start_ts) for r in run_ids)
        now = sum(self.equity(r, None) for r in run_ids)
        return now - base, (now / base - 1 if base else 0.0)

    def day_pnl_pct(self, run_ids: list[str], at: datetime) -> float:
        return self.day_pnl(run_ids, at)[1]

    def room_equity(self, room: str, at: datetime) -> float:
        return sum(self.equity(r, None) for r in self.room_runs(room, at))

    def exposure(self, room: str, ticker: str, at: datetime) -> float:
        total = 0.0
        for run_id in self.room_runs(room, at):
            # ações: capital alocado; minicontratos: margem em uso
            total += self._accounts.broker_for(run_id).exposure(ticker)
        return total

    # ---------- decisão ----------

    def allows_new_orders(
        self,
        room: str,
        ticker: str,
        at: datetime,
        extra_exposure: float,
        robot_id: str | None = None,
    ) -> tuple[bool, str | None]:
        scopes = [(BUILDING, "prédio"), (room, "sala")]
        if robot_id is not None:
            scopes.append((robot_scope(robot_id), "robô"))
        for scope, label in scopes:
            paused, why = self.status(scope, at)
            if paused:
                return False, f"{label} pausado: {why}"

        room_cfg = self._office.room(room)
        room_runs = self.room_runs(room, at)
        room_pnl = self.day_pnl_pct(room_runs, at)
        if room_cfg is not None and room_pnl <= -float(room_cfg.max_daily_loss):
            reason = f"perda do dia da sala {room_pnl:.2%} (limite {room_cfg.max_daily_loss:.0%})"
            self.pause(room, reason, until=_midnight_after(at))
            return False, reason

        building_pnl = self.building_day_pnl(at)[1]  # em reais (salas em dólar convertidas)
        if building_pnl <= -float(self._office.building_max_daily_loss):
            reason = f"perda do dia do prédio {building_pnl:.2%}"
            self.pause(BUILDING, reason, until=_midnight_after(at))
            return False, reason

        if room_cfg is not None:
            cap = float(room_cfg.max_instrument_exposure) * self.room_equity(room, at)
            current = self.exposure(room, ticker, at)
            if current + extra_exposure > cap:
                return False, (
                    f"exposição somada em {ticker} passaria do limite: "
                    f"R$ {current + extra_exposure:,.0f} > R$ {cap:,.0f}"
                )
        return True, None
