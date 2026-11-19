"""Backtest por robô: conta separada, sem look-ahead, validações e resultado gravado."""

import asyncio
from datetime import datetime

import pandas as pd
import pytest
from sqlalchemy import func, select

from app.backtest import runner as runner_mod
from app.backtest.runner import BacktestError, list_backtests, run_backtest
from app.clock import TZ_BRASILIA
from app.data.prices import available_at
from app.db.models import equity_history, orders
from app.engine.step import robot_step
from app.office.config import RobotConfig
from tests.test_engine_step import AT, ROBOT, _ctx

START = datetime(2026, 7, 1, tzinfo=TZ_BRASILIA)


def _count(ctx, table, account_id):  # type: ignore[no-untyped-def]
    with ctx.accounts.engine.connect() as conn:
        return conn.execute(
            select(func.count()).select_from(table).where(table.c.account_id == account_id)
        ).scalar_one()


def test_backtest_usa_execucao_propria_e_grava_resultado() -> None:
    ctx = _ctx()
    res = asyncio.run(run_backtest(ctx, ROBOT, START, AT))
    runs = ctx.accounts.runs_of(ROBOT.id)
    assert [r["mode"] for r in runs] == ["backtest"]
    assert runs[0]["ended_ts"] is not None
    assert res["run_id"] == runs[0]["id"] and res["steps"] > 90
    assert _count(ctx, equity_history, res["run_id"]) == res["steps"]
    m = res["metrics"]
    assert m["asset_return"] is not None and m["index_return"] is not None
    assert m["llm_cost"] == 0.0
    assert res["verdict"]["passed"] is False  # menos de 2 anos
    assert len(res["benchmark_curve"]) == res["steps"]
    assert list_backtests(ctx.accounts.engine, ROBOT.id)[0]["run_id"] == res["run_id"]


def test_backtest_nunca_ve_candle_futuro(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seen: list[tuple[pd.Timestamp, datetime]] = []
    real = runner_mod.decide_step

    async def spy(ctx, robot, run_id, candles, at, *, emit=True):  # type: ignore[no-untyped-def]
        assert emit is False
        seen.append((max(available_at(ts, "1d") for ts in candles.index), at))
        return await real(ctx, robot, run_id, candles, at, emit=emit)

    monkeypatch.setattr(runner_mod, "decide_step", spy)
    asyncio.run(run_backtest(_ctx(), ROBOT, START, AT))
    assert seen and all(last <= pd.Timestamp(at) for last, at in seen)


def test_backtest_nao_mexe_na_conta_ao_vivo() -> None:
    ctx = _ctx()
    live = asyncio.run(robot_step(ctx, ROBOT, AT)).run_id
    before = (_count(ctx, orders, live), _count(ctx, equity_history, live))
    asyncio.run(run_backtest(ctx, ROBOT, START, AT))
    assert (_count(ctx, orders, live), _count(ctx, equity_history, live)) == before
    assert ctx.accounts.live_run(ROBOT, AT) == live


def test_periodo_sem_candles_nao_quebra() -> None:
    ctx = _ctx()
    res = asyncio.run(
        run_backtest(
            ctx,
            ROBOT,
            datetime(2026, 1, 5, tzinfo=TZ_BRASILIA),
            datetime(2026, 3, 1, tzinfo=TZ_BRASILIA),
        )
    )
    assert res["metrics"]["trades"] == 0
    assert res["metrics"]["asset_return"] is None
    assert res["metrics"]["win_rate"] is None


@pytest.mark.parametrize(
    ("start", "end", "msg"),
    [
        (AT, START, "início"),
        (START, datetime(2026, 12, 1, tzinfo=TZ_BRASILIA), "futuro"),
    ],
)
def test_periodo_invalido(start, end, msg) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(BacktestError, match=msg):
        asyncio.run(run_backtest(_ctx(), ROBOT, start, end))


def test_mesa_ia_fora_do_backtest() -> None:
    mesa = RobotConfig.model_validate(
        {
            "id": "mesa-ia",
            "name": "MESA IA",
            "room": "acoes",
            "ticker": "PETR4.SA",
            "strategy": {"kind": "mesa_ia"},
        }
    )
    with pytest.raises(BacktestError, match="Mesa IA"):
        asyncio.run(run_backtest(_ctx(), mesa, START, AT))
