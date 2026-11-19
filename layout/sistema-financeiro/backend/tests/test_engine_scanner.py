"""Robôs rastreadores: escolhem entre vários ativos, com o risco de sempre."""

import asyncio
from datetime import datetime

import pandas as pd
import pytest

from app.backtest.runner import BacktestError, run_backtest
from app.broker.futures import FuturesBroker
from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.data.prices import PriceStore
from app.db.models import make_engine
from app.engine.step import AllowAll, EngineContext, robot_step
from app.events import EventBus
from app.office.accounts import AccountRegistry, broker_terms, contract_specs
from app.office.config import OfficeConfig
from tests.fakes import FakePrices

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)
STOCKS = ["AAAA3.SA", "BBBB3.SA", "CCCC3.SA", "ZZZZ3.SA"]


class SemZ(FakePrices):
    """ZZZZ3.SA sem dados (ativo novo/suspenso): o rastreador ignora e segue."""

    def fetch(self, ticker, start, end, interval):  # type: ignore[no-untyped-def]
        if ticker == "ZZZZ3.SA":
            return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
        return super().fetch(ticker, start, end, interval)


def _ctx(trend: str, office: dict) -> EngineContext:  # type: ignore[type-arg]
    engine = make_engine("sqlite://")
    clock = SimulatedClock(AT)
    prices = PriceStore(engine, SemZ(trend), wall_clock=lambda: clock.now().timestamp())
    cfg = OfficeConfig.model_validate(office)
    return EngineContext(
        settings=Settings(_env_file=None, database_url="sqlite://"),
        prices=prices,
        accounts=AccountRegistry(
            engine,
            fee_pct=0.0003,
            slippage_pct=0.0005,
            contracts=contract_specs(cfg),
            terms=broker_terms(cfg),
        ),
        office=cfg,
        bus=EventBus(),
        clock=clock,
        office_risk=AllowAll(),
    )


ACOES = {
    "rooms": [{"id": "acoes", "name": "Ações", "assets": STOCKS}],
    "robots": [
        {
            "id": "s1",
            "name": "S1",
            "room": "acoes",
            "ticker": "VARREDURA",
            "universe": STOCKS,
            "max_positions": 2,
            "min_avg_volume": 0,
            "strategy": {"kind": "atr_trend"},
        }
    ],
}


def test_rastreador_abre_as_melhores_ate_o_limite_de_vagas() -> None:
    ctx = _ctx("alta", ACOES)
    robot = ctx.office.robot("s1")
    assert robot is not None
    res = asyncio.run(robot_step(ctx, robot, AT))
    broker = ctx.accounts.broker_for(res.run_id)
    pending = broker.list_orders(status="pending")
    # séries iguais → empate → ordem alfabética; ZZZZ3 sem dados é ignorada
    assert sorted(o.ticker for o in pending) == ["AAAA3.SA", "BBBB3.SA"]
    assert all(o.side == "COMPRA" and o.stop is not None for o in pending)
    again = asyncio.run(robot_step(ctx, robot, AT))
    assert len(broker.list_orders(status="pending")) == 2 and again.order_id is None


MINIS = {
    "rooms": [{"id": "minis", "name": "Minis"}],
    "instruments": [
        {
            "symbol": "WIN",
            "name": "Mini-índice",
            "source": "^BVSP",
            "multiplier": 0.2,
            "fee_per_contract": 0.5,
            "margin_per_contract": 4000,
        },
        {
            "symbol": "WDO",
            "name": "Mini-dólar",
            "source": "USDBRL=X",
            "multiplier": 10,
            "fee_per_contract": 1.2,
            "margin_per_contract": 9000,
        },
    ],
    "robots": [
        {
            "id": "q1",
            "name": "Q1",
            "room": "minis",
            "ticker": "VARREDURA",
            "universe": ["WIN", "WDO"],
            "short": True,
            "max_positions": 2,
            "min_avg_volume": 0,
            "strategy": {"kind": "atr_trend"},
        }
    ],
}


def test_rastreador_de_minis_vende_com_o_contrato_de_cada_ativo() -> None:
    ctx = _ctx("baixa", MINIS)
    robot = ctx.office.robot("q1")
    assert robot is not None
    res = asyncio.run(robot_step(ctx, robot, AT))
    broker = ctx.accounts.broker_for(res.run_id)
    assert isinstance(broker, FuturesBroker)
    assert broker.spec_for("WDO").multiplier == 10 and broker.spec_for("WIN").multiplier == 0.2
    pending = broker.list_orders(status="pending")
    assert {o.ticker for o in pending} == {"WIN", "WDO"}
    assert all(o.side == "VENDA" for o in pending)


def test_backtest_de_rastreador_ainda_nao_existe() -> None:
    ctx = _ctx("alta", ACOES)
    robot = ctx.office.robot("s1")
    assert robot is not None
    with pytest.raises(BacktestError, match="rastreador"):
        asyncio.run(run_backtest(ctx, robot, datetime(2026, 6, 1, tzinfo=TZ_BRASILIA), AT))


def test_nova_compra_avalia_o_dia_com_todas_as_posicoes_marcadas(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from datetime import timedelta

    from app.broker.paper import PaperBroker

    office = {
        **ACOES,
        "robots": [{**ACOES["robots"][0], "max_positions": 3, "max_trades_per_day": 2}],
    }
    ctx = _ctx("alta", office)
    robot = ctx.office.robot("s1")
    assert robot is not None
    asyncio.run(robot_step(ctx, robot, AT))  # abre AAAA3 e BBBB3 (limite de 2 no dia)
    later = AT + timedelta(days=2)
    ctx.clock.set(later)  # type: ignore[attr-defined]
    seen: list[set[str]] = []
    original = PaperBroker.daily_pnl_pct

    def spy(self, at, marks):  # type: ignore[no-untyped-def]
        seen.append(set(marks))
        return original(self, at, marks)

    monkeypatch.setattr(PaperBroker, "daily_pnl_pct", spy)
    asyncio.run(robot_step(ctx, robot, later))  # posições executadas; abre CCCC3
    assert seen and {"AAAA3.SA", "BBBB3.SA", "CCCC3.SA"} <= seen[-1]
