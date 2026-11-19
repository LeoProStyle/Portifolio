"""Motor dos robôs de minicontratos: vendido, prontidão do câmbio 24h e backtest."""

import asyncio
from datetime import datetime
from decimal import Decimal

import pandas as pd

from app.backtest.runner import run_backtest
from app.broker.futures import FuturesBroker
from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.data.prices import PriceStore, available_at
from app.db.models import make_engine
from app.engine import futures as fut_mod
from app.engine.step import AllowAll, EngineContext, robot_step
from app.events import EventBus
from app.office.accounts import AccountRegistry, contract_specs
from app.office.config import OfficeConfig
from app.strategies.base import Signal
from tests.fakes import FakePrices

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)

INSTRUMENTS = [
    {
        "symbol": "WIN",
        "name": "Mini-índice",
        "source": "^BVSP",
        "multiplier": 0.2,
        "fee_per_contract": 0.5,
        "margin_per_contract": 4000,
        "slippage_points": 0.05,
    },
    {
        "symbol": "WDO",
        "name": "Mini-dólar",
        "source": "USDBRL=X",
        "scale": 1,  # o fixture usa preços ~30–40; a escala ×1000 tem teste próprio
        "multiplier": 10,
        "fee_per_contract": 1.2,
        "margin_per_contract": 9000,
    },
]


def _robot(rid: str, ticker: str, kind: str = "atr_trend") -> dict:  # type: ignore[type-arg]
    return {
        "id": rid,
        "name": rid.upper(),
        "room": "minis",
        "ticker": ticker,
        "short": True,
        "min_avg_volume": 0,
        "strategy": {"kind": kind},
    }


def _ctx(trend: str = "baixa") -> tuple[EngineContext, list]:  # type: ignore[type-arg]
    engine = make_engine("sqlite://")
    clock = SimulatedClock(AT)
    prices = PriceStore(engine, FakePrices(trend), wall_clock=lambda: clock.now().timestamp())
    office = OfficeConfig.model_validate(
        {
            "rooms": [{"id": "minis", "name": "Minicontratos"}],
            "instruments": INSTRUMENTS,
            "robots": [_robot("w1", "WIN"), _robot("d1", "WDO")],
        }
    )
    recorded: list = []  # type: ignore[type-arg]
    bus = EventBus(recorder=recorded.append)
    ctx = EngineContext(
        settings=Settings(_env_file=None, database_url="sqlite://"),
        prices=prices,
        accounts=AccountRegistry(
            engine, fee_pct=0.0003, slippage_pct=0.0005, contracts=contract_specs(office)
        ),
        office=office,
        bus=bus,
        clock=clock,
        office_risk=AllowAll(),
    )
    return ctx, recorded


def test_robo_de_minis_abre_vendido_na_queda() -> None:
    ctx, events = _ctx("baixa")
    robot = ctx.office.robot("w1")
    assert robot is not None
    res = asyncio.run(robot_step(ctx, robot, AT))
    broker = ctx.accounts.broker_for(res.run_id)
    assert isinstance(broker, FuturesBroker)
    order = broker.list_orders(status="pending")[0]
    assert order.side == "VENDA" and order.qty >= 1
    assert order.stop is not None and order.stop > 30  # stop ACIMA do preço (vendido)
    decision = next(e for e in events if e.type == "decision")
    assert decision.room == "minis" and decision.payload.action == "VENDA"


def test_vendido_continua_sem_virar_a_mao() -> None:
    ctx, _ = _ctx("baixa")
    robot = ctx.office.robot("w1")
    assert robot is not None
    first = asyncio.run(robot_step(ctx, robot, AT))
    later = datetime(2026, 11, 20, 18, 30, tzinfo=TZ_BRASILIA)
    ctx.clock.set(later)  # type: ignore[attr-defined]
    asyncio.run(robot_step(ctx, robot, later))
    broker = ctx.accounts.broker_for(first.run_id)
    assert broker.position_qty("WIN") < 0
    assert all(o.side == "VENDA" for o in broker.list_orders() if o.reason == "decisao")


def test_cambio_24h_nunca_entrega_candle_aberto(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seen: list[pd.Timestamp] = []

    class Spy:
        def decide(self, candles, position_qty):  # type: ignore[no-untyped-def]
            if not candles.empty:
                seen.append(max(available_at(ts, "1d", "USDBRL=X") for ts in candles.index))
            return Signal("ESPERA", "spy")

    monkeypatch.setattr(fut_mod, "build_strategy", lambda spec: Spy())
    ctx, _ = _ctx()
    robot = ctx.office.robot("d1")
    assert robot is not None
    asyncio.run(robot_step(ctx, robot, AT))
    assert seen and all(s <= pd.Timestamp(AT) for s in seen)


def test_backtest_de_robo_win_roda_em_conta_separada() -> None:
    ctx, _ = _ctx("baixa")
    robot = ctx.office.robot("w1")
    assert robot is not None
    start = datetime(2026, 7, 1, tzinfo=TZ_BRASILIA)
    result = asyncio.run(run_backtest(ctx, robot, start, AT))
    assert result["run_id"].startswith("bt-w1")
    assert result["metrics"]["trades"] >= 0
    assert result["benchmark"] == "1 contrato de WIN"
    runs = ctx.accounts.runs_of("w1")
    assert all(r["mode"] == "backtest" for r in runs)


def test_risco_por_operacao_da_sala_vale_para_o_robo() -> None:
    ctx, _ = _ctx("baixa")
    tiny = ctx.office.model_copy(
        update={
            "rooms": [
                ctx.office.rooms[0].model_copy(update={"max_risk_per_trade": Decimal("0.000001")})
            ]
        }
    )
    ctx.office = tiny
    robot = ctx.office.robot("w1")
    assert robot is not None
    res = asyncio.run(robot_step(ctx, robot, AT))
    assert res.order_id is None
    assert res.blocked_reason and "nenhum contrato cabe" in res.blocked_reason


def test_ordem_pendente_do_cambio_nao_e_repetida_no_dia_seguinte() -> None:
    # USDBRL=X: a ordem de D só aparece executada para o robô em D+2 (candle de 24h).
    ctx, _ = _ctx("alta")
    robot = ctx.office.robot("d1")
    assert robot is not None
    first = asyncio.run(robot_step(ctx, robot, AT))
    nxt = datetime(2026, 11, 19, 18, 30, tzinfo=TZ_BRASILIA)
    ctx.clock.set(nxt)  # type: ignore[attr-defined]
    second = asyncio.run(robot_step(ctx, robot, nxt))
    broker = ctx.accounts.broker_for(first.run_id)
    opens = [o for o in broker.list_orders() if o.reason == "decisao"]
    assert len(opens) == 1
    assert second.order_id is None and "pendente" in second.signal.reason
