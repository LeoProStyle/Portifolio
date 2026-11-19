"""Execuções (runs) e contas simuladas por robô.

Cada execução tem um id que também é o `account_id` da conta no PaperBroker.
Uma execução "live" fica aberta enquanto a configuração do robô (hash) não
muda; mudou o hash, a antiga é fechada e uma nova começa com conta zerada.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Engine, insert, select, update

from app.broker.futures import ContractSpec, FuturesBroker
from app.broker.paper import PaperBroker
from app.db.models import runs
from app.office.config import InstrumentConfig, OfficeConfig, RobotConfig

LEGACY_HASH = "legacy"  # execução criada pela migração 0002 (carteira única antiga)


@dataclass(frozen=True)
class BrokerTerms:
    """Custos e passo de quantidade da sala do robô (vazio = os do .env)."""

    fee_pct: float | None = None
    slippage_pct: float | None = None
    qty_step: float = 1.0


def broker_terms(office: OfficeConfig) -> dict[str, BrokerTerms]:
    """Robôs de salas com custos/passo próprios (ex.: cripto 0,1% e passo 0,0001)."""
    out: dict[str, BrokerTerms] = {}
    for robot in office.robots:
        room = office.room(robot.room)
        if room is None:
            continue
        if room.fee_pct is None and room.slippage_pct is None and room.qty_step == 1:
            continue
        out[robot.id] = BrokerTerms(
            fee_pct=None if room.fee_pct is None else float(room.fee_pct),
            slippage_pct=None if room.slippage_pct is None else float(room.slippage_pct),
            qty_step=float(room.qty_step),
        )
    return out


def _spec(inst: InstrumentConfig) -> ContractSpec:
    return ContractSpec(
        multiplier=inst.multiplier,
        fee_per_contract=inst.fee_per_contract,
        margin_per_contract=inst.margin_per_contract,
        slippage_points=inst.slippage_points,
    )


def contract_specs(office: OfficeConfig) -> dict[str, ContractSpec | dict[str, ContractSpec]]:
    """Robôs de instrumento (minicontratos) → especificação do contrato."""
    out: dict[str, ContractSpec | dict[str, ContractSpec]] = {}
    for robot in office.robots:
        if robot.universe:
            per = {t: _spec(i) for t in robot.universe if (i := office.instrument(t))}
            if per:
                out[robot.id] = per
            continue
        inst = office.instrument(robot.ticker)
        if inst is not None:
            out[robot.id] = ContractSpec(
                multiplier=inst.multiplier,
                fee_per_contract=inst.fee_per_contract,
                margin_per_contract=inst.margin_per_contract,
                slippage_points=inst.slippage_points,
            )
    return out


class AccountRegistry:
    def __init__(
        self,
        engine: Engine,
        *,
        fee_pct: float,
        slippage_pct: float,
        contracts: dict[str, ContractSpec | dict[str, ContractSpec]] | None = None,
        terms: dict[str, BrokerTerms] | None = None,
    ) -> None:
        self._engine = engine
        self._fee_pct = fee_pct
        self._slip = slippage_pct
        # robô de minicontrato → contrato: conta de futuro em vez de conta de ações
        self._contracts = contracts or {}
        self._terms = terms or {}
        self._brokers: dict[str, PaperBroker] = {}

    @property
    def engine(self) -> Engine:
        return self._engine

    def live_run(self, robot: RobotConfig, now: datetime) -> str:
        """Execução ao vivo aberta do robô; abre uma nova se a configuração mudou."""
        current = robot.config_hash()
        with self._engine.begin() as conn:
            row = (
                conn.execute(
                    select(runs).where(
                        runs.c.robot_id == robot.id,
                        runs.c.mode == "live",
                        runs.c.ended_ts.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            if row is not None and row["config_hash"] == LEGACY_HASH:
                # adota a carteira antiga (Fases 1–4) como execução atual do robô
                conn.execute(update(runs).where(runs.c.id == row["id"]).values(config_hash=current))
                return str(row["id"])
            if row is not None and row["config_hash"] == current:
                return str(row["id"])
            ts = int(now.timestamp())
            if row is not None:
                conn.execute(update(runs).where(runs.c.id == row["id"]).values(ended_ts=ts))
            run_id = f"{robot.id}-{current[:8]}-{ts}"
            conn.execute(
                insert(runs).values(
                    id=run_id,
                    robot_id=robot.id,
                    mode="live",
                    config_hash=current,
                    initial_cash=float(robot.initial_cash),
                    started_ts=ts,
                    ended_ts=None,
                )
            )
            return run_id

    def new_backtest_run(self, robot: RobotConfig, now: datetime) -> str:
        """Execução de backtest: conta zerada própria, nunca a do ao vivo."""
        current = robot.config_hash()
        ts = int(now.timestamp())
        run_id = f"bt-{robot.id}-{current[:8]}-{ts}-{uuid.uuid4().hex[:6]}"
        with self._engine.begin() as conn:
            conn.execute(
                insert(runs).values(
                    id=run_id,
                    robot_id=robot.id,
                    mode="backtest",
                    config_hash=current,
                    initial_cash=float(robot.initial_cash),
                    started_ts=ts,
                    ended_ts=None,
                )
            )
        return run_id

    def end_run(self, run_id: str, now: datetime) -> None:
        """Fecha a execução e libera o broker em memória."""
        with self._engine.begin() as conn:
            conn.execute(
                update(runs).where(runs.c.id == run_id).values(ended_ts=int(now.timestamp()))
            )
        self._brokers.pop(run_id, None)

    def run_info(self, run_id: str) -> dict[str, Any] | None:
        with self._engine.connect() as conn:
            row = conn.execute(select(runs).where(runs.c.id == run_id)).mappings().first()
        return dict(row) if row else None

    def runs_of(self, robot_id: str) -> list[dict[str, Any]]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                select(runs).where(runs.c.robot_id == robot_id).order_by(runs.c.started_ts)
            ).mappings()
            return [dict(r) for r in rows]

    def broker_for(self, run_id: str) -> PaperBroker:
        """PaperBroker da conta (um por execução, reaproveitado)."""
        if run_id not in self._brokers:
            info = self.run_info(run_id)
            if info is None:
                raise KeyError(f"Execução inexistente: {run_id}")
            spec = self._contracts.get(str(info["robot_id"]))
            if spec is not None:
                self._brokers[run_id] = FuturesBroker(
                    self._engine,
                    initial_cash=float(info["initial_cash"]),
                    spec=spec,
                    account_id=run_id,
                )
                return self._brokers[run_id]
            terms = self._terms.get(str(info["robot_id"]), BrokerTerms())
            self._brokers[run_id] = PaperBroker(
                self._engine,
                initial_cash=float(info["initial_cash"]),
                fee_pct=self._fee_pct if terms.fee_pct is None else terms.fee_pct,
                slippage_pct=self._slip if terms.slippage_pct is None else terms.slippage_pct,
                account_id=run_id,
                qty_step=terms.qty_step,
            )
        return self._brokers[run_id]
