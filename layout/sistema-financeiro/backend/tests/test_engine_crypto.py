"""Robôs de cripto: quantidade fracionária, custos da sala e calendário 24/7."""

import asyncio
from datetime import datetime

import pandas as pd
import pytest

from app.broker.paper import PaperBroker
from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.data.prices import PriceStore
from app.db.models import make_engine
from app.engine.step import AllowAll, EngineContext, robot_step
from app.events import EventBus
from app.office.accounts import AccountRegistry, broker_terms, contract_specs
from app.office.config import OfficeConfig
from tests.fakes import FakePrices

AT = datetime(2026, 11, 18, 21, 30, tzinfo=TZ_BRASILIA)

OFFICE = {
    "rooms": [
        {
            "id": "cripto",
            "name": "Cripto",
            "currency": "USD",
            "calendar": "24x7",
            "assets": ["BTC-USD"],
            "fee_pct": "0.001",
            "slippage_pct": "0.0005",
            "qty_step": "0.0001",
        }
    ],
    "robots": [
        {
            "id": "c1",
            "name": "C1",
            "room": "cripto",
            "ticker": "BTC-USD",
            "initial_cash": 20,  # caixa pequeno: só cabe fração de "moeda" (preços ~30–40)
            "min_avg_volume": 0,
            "strategy": {"kind": "atr_trend"},
        }
    ],
}


def _ctx() -> EngineContext:
    engine = make_engine("sqlite://")
    clock = SimulatedClock(AT)
    prices = PriceStore(engine, FakePrices("alta"), wall_clock=lambda: clock.now().timestamp())
    office = OfficeConfig.model_validate(OFFICE)
    return EngineContext(
        settings=Settings(_env_file=None, database_url="sqlite://"),
        prices=prices,
        accounts=AccountRegistry(
            engine,
            fee_pct=0.0003,
            slippage_pct=0.0005,
            contracts=contract_specs(office),
            terms=broker_terms(office),
        ),
        office=office,
        bus=EventBus(),
        clock=clock,
        office_risk=AllowAll(),
    )


def test_robo_de_cripto_compra_fracao_com_custos_da_sala() -> None:
    ctx = _ctx()
    robot = ctx.office.robot("c1")
    assert robot is not None
    res = asyncio.run(robot_step(ctx, robot, AT))
    broker = ctx.accounts.broker_for(res.run_id)
    assert isinstance(broker, PaperBroker)
    assert broker.fee_pct == pytest.approx(0.001) and broker.qty_step == pytest.approx(0.0001)
    order = broker.list_orders(status="pending")[0]
    assert 0 < order.qty < 1
    assert round(order.qty / 0.0001, 6) == int(round(order.qty / 0.0001))


def test_backtest_de_cripto_decide_todo_dia_e_compara_com_btc() -> None:
    from app.backtest.runner import run_backtest

    ctx = _ctx()
    robot = ctx.office.robot("c1")
    assert robot is not None
    start = datetime(2026, 10, 1, tzinfo=TZ_BRASILIA)
    result = asyncio.run(run_backtest(ctx, robot, start, AT))
    # 1/10 a 18/11 às 21:30: todo dia às 21:00 (inclui fins de semana) = 49 decisões
    assert result["steps"] == 49
    assert result["benchmark"] == "BTC-USD" and result["currency"] == "USD"
    assert all(r["mode"] == "backtest" for r in ctx.accounts.runs_of("c1"))


class Fake21h(FakePrices):
    """Como o yfinance marca cripto: candle diário às 21:00 de Brasília do dia anterior."""

    def fetch(self, ticker, start, end, interval):  # type: ignore[no-untyped-def]
        df = super().fetch(ticker, start, end, interval)
        df.index = df.index - pd.Timedelta(hours=3)
        return df


def test_cripto_executa_no_candle_seguinte_e_nao_repete_a_ordem() -> None:
    import pandas as pd  # noqa: F401  (usado pela Fake21h)

    ctx = _ctx()
    clock = SimulatedClock(datetime(2026, 11, 16, 21, 0, tzinfo=TZ_BRASILIA))
    ctx.clock = clock
    ctx.prices = PriceStore(
        ctx.accounts.engine, Fake21h("alta"), wall_clock=lambda: clock.now().timestamp()
    )
    robot = ctx.office.robot("c1")
    assert robot is not None
    first = asyncio.run(robot_step(ctx, robot, clock.now()))
    assert first.order_id is not None
    clock.set(datetime(2026, 11, 17, 21, 0, tzinfo=TZ_BRASILIA))
    second = asyncio.run(robot_step(ctx, robot, clock.now()))
    broker = ctx.accounts.broker_for(first.run_id)
    buys = [o for o in broker.list_orders() if o.reason == "decisao" and o.side == "COMPRA"]
    assert len(buys) == 1  # não repetiu a ordem
    # executou na abertura do candle que começou às 21:00 do dia da ordem (o seguinte ao sinal)
    assert buys[0].status == "filled"
    assert buys[0].filled_at == datetime(2026, 11, 16, 21, 0, tzinfo=TZ_BRASILIA)
    assert broker.position_qty("BTC-USD") > 0 and second.order_id is None


def test_acao_com_ordem_pendente_espera() -> None:
    ctx = _ctx()
    robot = ctx.office.robot("c1")
    assert robot is not None
    first = asyncio.run(robot_step(ctx, robot, AT))
    again = asyncio.run(robot_step(ctx, robot, AT))  # mesma hora: ordem ainda pendente
    assert first.order_id is not None and again.order_id is None
    assert "pendente" in again.signal.reason
