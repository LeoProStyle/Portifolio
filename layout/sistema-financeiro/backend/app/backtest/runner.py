"""Backtest por robô: replay histórico SEM look-ahead, numa conta separada.

- Usa o MESMO passo do ao vivo (`decide_step`): estratégia, plano de saída,
  risco do robô, taxas, slippage e execução na abertura do candle seguinte.
- Execução própria (`runs.mode="backtest"`): nunca toca a conta ao vivo e não
  entra no P&L da sala/prédio (que só soma execuções "live").
- Candles carregados uma vez e fatiados por instante com a MESMA janela do ao
  vivo; em cada instante só entram candles completos (`available_at <= at`).
- Sem eventos na sala e sem risco do escritório (é um robô isolado no passado).
- Mesa IA fica de fora (spec §8): não há notícias históricas e o LLM "conhece"
  o passado; ela é avaliada só ao vivo.
"""

import asyncio
import dataclasses
import json
import time
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from sqlalchemy import Engine, insert, select

from app.backtest.metrics import Fill, compute_metrics, round_trips, verdict
from app.clock import TZ_BRASILIA
from app.data.instruments import InstrumentFeed
from app.data.prices import available_at
from app.db.models import backtests, equity_history, orders
from app.engine.catchup import decision_times, robot_calendar
from app.engine.step import (
    LOOKBACK_DAYS,
    AllowAll,
    EngineContext,
    decide_step,
    load_candles,
    source_ticker,
)
from app.office.config import RobotConfig

CRYPTO_BENCHMARK = "BTC-USD"
MAX_DAYS_1H = 729  # o yfinance só guarda ~730 dias de candles de 1h


class BacktestError(ValueError):
    """Pedido de backtest inválido (mensagem pronta para a tela)."""


def _validate(robot: RobotConfig, start: datetime, end: datetime, now: datetime) -> None:
    if robot.strategy.kind == "mesa_ia":
        raise BacktestError(
            "A Mesa IA não entra no backtest: não há notícias históricas e o LLM "
            "já 'conhece' o passado. Ela é avaliada só pela simulação ao vivo."
        )
    if robot.universe:
        raise BacktestError(
            "Backtest de robô rastreador ainda não está disponível: ele é avaliado ao vivo, "
            "contra a cesta igual dos ativos da lista."
        )
    if start >= end:
        raise BacktestError("O início do período precisa ser antes do fim.")
    if end > now:
        raise BacktestError("O fim do período não pode estar no futuro.")
    if robot.interval == "1h" and (now - start).days > MAX_DAYS_1H:
        raise BacktestError(f"Robôs de 1h: no máximo {MAX_DAYS_1H} dias de histórico.")


def _window_start(at: datetime, interval: str) -> pd.Timestamp:
    """Mesmo início de janela que `PriceStore.get_candles` usa no ao vivo."""
    start = (at - timedelta(days=LOOKBACK_DAYS[interval])).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return pd.Timestamp(start)


def _closes_at(
    candles: pd.DataFrame, interval: str, times: list[datetime], ticker: str | None = None
) -> list[float | None]:
    """Último fechamento disponível em cada instante (para o benchmark)."""
    if candles.empty:
        return [None] * len(times)
    ready = pd.DatetimeIndex(
        [available_at(ts, interval, ticker) for ts in candles.index], tz=TZ_BRASILIA
    )
    out: list[float | None] = []
    for at in times:
        ok = candles["close"][ready <= pd.Timestamp(at)]
        out.append(float(ok.iloc[-1]) if not ok.empty else None)
    return out


def _contract_return(closes: list[float | None], multiplier: float, initial: float) -> float | None:
    """Comprar e segurar 1 contrato: (último − primeiro) × multiplicador ÷ capital inicial."""
    known = [c for c in closes if c is not None]
    if len(known) < 2 or initial <= 0:
        return None
    return (known[-1] - known[0]) * multiplier / initial


def _room_currency(ctx: EngineContext, robot: RobotConfig) -> str:
    room = ctx.office.room(robot.room)
    return room.currency if room is not None else "BRL"


def _run_slippage(ctx: EngineContext, robot: RobotConfig) -> float:
    """Slippage da conta do robô: o da sala (ex.: cripto) ou o do .env."""
    room = ctx.office.room(robot.room)
    if room is not None and room.slippage_pct is not None:
        return float(room.slippage_pct)
    return float(ctx.settings.slippage_pct)


def _period_return(closes: list[float | None]) -> float | None:
    known = [c for c in closes if c is not None]
    if len(known) < 2 or known[0] == 0:
        return None
    return known[-1] / known[0] - 1


def _fills(engine: Engine, run_id: str) -> list[Fill]:
    with engine.connect() as conn:
        rows = conn.execute(
            select(orders)
            .where(orders.c.account_id == run_id, orders.c.status == "filled")
            .order_by(orders.c.filled_ts)
        ).mappings()
        return [
            Fill(
                datetime.fromtimestamp(r["filled_ts"], TZ_BRASILIA),
                r["side"],
                float(r["filled_qty"] or 0),  # cripto: fracionária
                float(r["fill_price"] or 0.0),
                float(r["fee"] or 0.0),
                r["reason"],
            )
            for r in rows
        ]


def _equity(engine: Engine, run_id: str) -> list[tuple[int, float]]:
    with engine.connect() as conn:
        rows = conn.execute(
            select(equity_history.c.ts, equity_history.c.equity)
            .where(equity_history.c.account_id == run_id)
            .order_by(equity_history.c.ts)
        )
        return [(int(ts), float(eq)) for ts, eq in rows]


def _slippage_paid(fills: list[Fill], slip: float) -> float:
    """Slippage embutido no preço: compra paga base×(1+s), venda recebe base×(1−s)."""
    total = 0.0
    for f in fills:
        base = f.price / (1 + slip) if f.side == "COMPRA" else f.price / (1 - slip)
        total += abs(f.price - base) * f.qty
    return total


def _index_closes(  # type: ignore[no-untyped-def]
    ctx: EngineContext, start: datetime, end: datetime, times: list[datetime], ticker: str
):
    try:
        idx = ctx.prices.get_candles(
            ticker, until=end, lookback_days=(end - start).days + 10, interval="1d"
        )
    except Exception:  # índice indisponível não derruba o backtest
        return [None] * len(times)
    return _closes_at(idx, "1d", times, ticker)


async def run_backtest(
    ctx: EngineContext, robot: RobotConfig, start: datetime, end: datetime
) -> dict[str, Any]:
    now = ctx.clock.now()
    _validate(robot, start, end, now)
    times = decision_times(robot.interval, start, end, robot_calendar(ctx.office, robot))
    run_id = ctx.accounts.new_backtest_run(robot, now)
    bt_ctx = dataclasses.replace(ctx, office_risk=AllowAll(), robot_locks={})

    lookback = (end - start).days + LOOKBACK_DAYS[robot.interval] + 1
    candles = load_candles(ctx, robot, end, lookback)
    src = source_ticker(ctx.office, robot)
    ready = pd.DatetimeIndex(
        [available_at(ts, robot.interval, src) for ts in candles.index], tz=TZ_BRASILIA
    )
    try:
        for at in times:
            mask = (candles.index >= _window_start(at, robot.interval)) & (
                ready <= pd.Timestamp(at)
            )
            await decide_step(bt_ctx, robot, run_id, candles[mask], at, emit=False)
            await asyncio.sleep(0)  # não trava o servidor (WS, outras rotas)
    finally:
        ctx.accounts.end_run(run_id, ctx.clock.now())

    engine = ctx.accounts.engine
    fills = _fills(engine, run_id)
    curve = _equity(engine, run_id)
    initial = float(robot.initial_cash)
    asset = _closes_at(candles, robot.interval, times, src)
    inst = ctx.office.instrument(robot.ticker)
    if inst is None:
        # cripto (spec §6.3): benchmark = comprar e segurar BTC; demais: o índice do .env
        room = ctx.office.room(robot.room)
        benchmark_label = (
            CRYPTO_BENCHMARK
            if room is not None and room.currency == "USD"
            else ctx.settings.benchmark
        )
        index = _index_closes(ctx, start, end, times, benchmark_label)
        asset_return, index_return = _period_return(asset), _period_return(index)
        trades = round_trips(fills)
        slip = _run_slippage(ctx, robot)
        slippage = _slippage_paid(fills, slip)
    else:
        # minicontratos (spec §8): benchmark = comprar e segurar 1 contrato de WIN
        win = ctx.office.instrument("WIN") or inst
        win_candles = InstrumentFeed(ctx.prices).get_candles(
            win, until=end, lookback_days=lookback, interval=robot.interval
        )
        win_closes = _closes_at(win_candles, robot.interval, times, win.source)
        asset_return = _contract_return(asset, inst.multiplier, initial)
        index_return = _contract_return(win_closes, win.multiplier, initial)
        trades = round_trips(fills, multiplier=inst.multiplier)
        slippage = sum(inst.slippage_points * f.qty * inst.multiplier for f in fills)
        benchmark_label = "1 contrato de WIN"
    metrics = compute_metrics(
        initial_cash=initial,
        equity=[eq for _, eq in curve],
        trades=trades,
        fees_paid=sum(f.fee for f in fills),
        slippage_paid=slippage,
        asset_return=asset_return,
        index_return=index_return,
    )
    period_days = (end - start).days
    v = verdict(
        metrics,
        period_days,
        max_dd=float(ctx.settings.candidate_max_drawdown),
        min_trades=ctx.settings.candidate_min_trades,
    )
    first_close = next((c for c in asset if c is not None), None)
    if inst is None:
        benchmark_curve = [
            {"time": int(at.timestamp()), "value": initial * c / first_close}
            for at, c in zip(times, asset, strict=True)
            if c is not None and first_close
        ]
    else:  # 1 contrato do próprio instrumento comprado e segurado
        benchmark_curve = [
            {"time": int(at.timestamp()), "value": initial + (c - first_close) * inst.multiplier}
            for at, c in zip(times, asset, strict=True)
            if c is not None and first_close is not None
        ]
    result: dict[str, Any] = {
        "run_id": run_id,
        "robot_id": robot.id,
        "robot_name": robot.name,
        "strategy": robot.strategy.kind,
        "ticker": robot.ticker,
        "interval": robot.interval,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "period_days": period_days,
        "steps": len(times),
        "created_ts": int(time.time()),
        "config_hash": robot.config_hash(),
        "benchmark": benchmark_label,
        "currency": _room_currency(ctx, robot),
        "metrics": metrics.as_dict(),
        "verdict": v.as_dict(),
        "benchmark_curve": benchmark_curve,
    }
    with engine.begin() as conn:
        conn.execute(
            insert(backtests).values(
                run_id=run_id,
                robot_id=robot.id,
                start_ts=int(start.timestamp()),
                end_ts=int(end.timestamp()),
                created_ts=result["created_ts"],
                result_json=json.dumps(result),
            )
        )
    return result


def list_backtests(engine: Engine, robot_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Resumos (sem curvas), mais recente primeiro."""
    with engine.connect() as conn:
        rows = conn.execute(
            select(backtests.c.result_json)
            .where(backtests.c.robot_id == robot_id)
            .order_by(backtests.c.created_ts.desc(), backtests.c.run_id.desc())
            .limit(limit)
        ).scalars()
        out = []
        for raw in rows:
            r = json.loads(raw)
            r.pop("benchmark_curve", None)
            out.append(r)
        return out


def get_backtest(engine: Engine, run_id: str) -> dict[str, Any] | None:
    """Resultado completo + curva de patrimônio + ordens executadas."""
    with engine.connect() as conn:
        raw = conn.execute(
            select(backtests.c.result_json).where(backtests.c.run_id == run_id)
        ).scalar()
    if raw is None:
        return None
    result: dict[str, Any] = json.loads(raw)
    result["equity_curve"] = [{"time": ts, "value": eq} for ts, eq in _equity(engine, run_id)]
    result["fills"] = [
        {
            "time": f.ts.isoformat(),
            "side": f.side,
            "qty": f.qty,
            "price": f.price,
            "fee": f.fee,
            "reason": f.reason,
        }
        for f in _fills(engine, run_id)
    ]
    return result
