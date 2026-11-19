"""Passo de decisão de um robô: compra, look-ahead, bloqueio do escritório e eventos."""

import asyncio
from datetime import datetime, timedelta

import pandas as pd

from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.data.prices import PriceStore, available_at
from app.db.models import make_engine
from app.engine import step as step_mod
from app.engine.step import AllowAll, EngineContext, robot_step
from app.events import EventBus
from app.office.accounts import AccountRegistry
from app.office.config import OfficeConfig, RobotConfig
from app.strategies.base import Signal
from tests.fakes import FakePrices

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)  # 18/11 já fechou às 18h

ROBOT = RobotConfig.model_validate(
    {
        "id": "rigel",
        "name": "RIGEL",
        "room": "acoes",
        "ticker": "PETR4.SA",
        "strategy": {"kind": "atr_trend"},
        "min_avg_volume": 0,
    }
)


class Block:
    def allows_new_orders(self, room, ticker, at, extra_exposure, robot_id=None):  # type: ignore[no-untyped-def]
        return False, "sala pausada"


def _ctx(gate=None) -> EngineContext:  # type: ignore[no-untyped-def]
    engine = make_engine("sqlite://")
    clock = SimulatedClock(AT)
    prices = PriceStore(engine, FakePrices("alta"), wall_clock=lambda: clock.now().timestamp())
    office = OfficeConfig.model_validate(
        {"rooms": [{"id": "acoes", "name": "Ações"}], "robots": [ROBOT.model_dump()]}
    )
    return EngineContext(
        settings=Settings(_env_file=None, database_url="sqlite://"),
        prices=prices,
        accounts=AccountRegistry(engine, fee_pct=0.0003, slippage_pct=0.0005),
        office=office,
        bus=EventBus(),
        clock=clock,
        office_risk=gate or AllowAll(),
    )


def test_step_compra_em_alta_cria_ordem_pendente_com_stop_e_alvo() -> None:
    ctx = _ctx()
    res = asyncio.run(robot_step(ctx, ROBOT, AT))
    assert res.signal.action == "COMPRA" and res.order_id is not None
    order = ctx.accounts.broker_for(res.run_id).list_orders(status="pending")[0]
    assert order.qty > 0 and order.stop is not None and order.stop < 40


def test_step_nunca_ve_candle_futuro(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seen: list[pd.Timestamp] = []

    class Spy:
        def decide(self, candles, position_qty):  # type: ignore[no-untyped-def]
            seen.append(max(available_at(ts, "1d") for ts in candles.index))
            return Signal("ESPERA", "spy")

    monkeypatch.setattr(step_mod, "build_strategy", lambda spec: Spy())
    at = datetime(2026, 11, 18, 14, 0, tzinfo=TZ_BRASILIA)  # pregão aberto: 18/11 incompleto
    asyncio.run(robot_step(_ctx(), ROBOT, at))
    assert seen and seen[0] <= pd.Timestamp(at)


def test_step_bloqueado_nao_cria_ordem_mas_processa_execucao() -> None:
    ctx = _ctx()
    first = asyncio.run(robot_step(ctx, ROBOT, AT - timedelta(days=1)))  # compra em 17/11
    assert first.order_id is not None
    ctx.office_risk = Block()
    res = asyncio.run(robot_step(ctx, ROBOT, AT))  # 18/11: executa a ordem; sem novas
    broker = ctx.accounts.broker_for(res.run_id)
    assert broker.position_qty("PETR4.SA") > 0
    assert broker.list_orders(status="pending") == []


def test_eventos_tem_room_e_robot_id() -> None:
    ctx = _ctx()

    async def run() -> list:
        async with ctx.bus.subscribe() as q:
            await robot_step(ctx, ROBOT, AT)
            return [q.get_nowait() for _ in range(q.qsize())]

    events = asyncio.run(run())
    assert events and all(e.room == "acoes" and e.robot_id == "rigel" for e in events)


def test_decide_step_sem_emit_nao_publica_eventos() -> None:
    from app.engine.step import decide_step

    ctx = _ctx()
    seen: list[str] = []
    ctx.bus = EventBus(recorder=lambda ev: seen.append(ev.type))
    run_id = ctx.accounts.live_run(ROBOT, AT)
    candles = ctx.prices.get_candles(ROBOT.ticker, until=AT, lookback_days=400)
    res = asyncio.run(step_mod.decide_step(ctx, ROBOT, run_id, candles, AT, emit=False))
    assert res.signal.action == "COMPRA" and res.order_id is not None
    assert seen == []
    assert decide_step is step_mod.decide_step
