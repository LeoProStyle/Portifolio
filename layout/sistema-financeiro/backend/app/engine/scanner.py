"""Passo de um robô RASTREADOR: escolhe entre vários ativos de uma lista fixa.

1. Processa execuções, stop e alvo de todos os ativos da lista (só candles completos).
2. Zera posições cujo sinal da estratégia mandou sair (saída nunca é bloqueada).
3. Com vagas livres (posições + ordens pendentes < max_positions), aplica a estratégia
   em todos os ativos, ordena os candidatos (`rank_candidates`) e abre os melhores com
   o MESMO risco dos outros robôs (stop/alvo, tamanho, risco do escritório).
Minicontratos: também o lado vendido (série espelhada) e o contrato de cada ativo.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

import pandas as pd

from app.broker.base import Side
from app.broker.futures import FuturesBroker
from app.data.prices import available_at
from app.engine.futures import _try_open
from app.events import make_event
from app.office.config import RobotConfig
from app.strategies import Signal, build_strategy
from app.strategies.rank import rank_candidates
from app.strategies.sides import invert

if TYPE_CHECKING:
    from app.engine.step import EngineContext, StepResult


def _ready(df: pd.DataFrame, interval: str, source: str, at: datetime) -> pd.DataFrame:
    if df.empty:
        return df
    ok = [available_at(ts, interval, source) <= pd.Timestamp(at) for ts in df.index]
    return df[ok]


async def scanner_step(
    ctx: "EngineContext", robot: RobotConfig, run_id: str, at: datetime, *, emit: bool = True
) -> "StepResult":
    from app.engine.step import LOOKBACK_DAYS, StepResult, _try_buy, load_candles, source_ticker

    broker = ctx.accounts.broker_for(run_id)
    futures = isinstance(broker, FuturesBroker)

    async def publish(type_: str, payload: dict[str, Any]) -> None:
        if emit:
            await ctx.bus.publish(
                make_event(type_, None, payload, room=robot.room, robot_id=robot.id)
            )

    # 1. dados e execuções de cada ativo (sem dados → ignorado)
    data: dict[str, pd.DataFrame] = {}
    for t in robot.universe:
        df = load_candles(ctx, robot, at, LOOKBACK_DAYS[robot.interval], ticker=t)
        df = _ready(df, robot.interval, source_ticker(ctx.office, robot, t), at)
        if df.empty:
            continue
        data[t] = df
        for fill in broker.process_candles(t, df):
            await publish(
                "order_filled",
                {
                    "ticker": fill.ticker,
                    "side": fill.side,
                    "qty": fill.qty,
                    "price": round(fill.price, 4),
                    "fee": round(fill.fee, 2),
                    "reason": fill.reason,
                    "time": fill.ts.isoformat(),
                },
            )
    marks = {t: float(df["close"].iloc[-1]) for t, df in data.items()}
    strategy = build_strategy(robot.strategy)
    notes: list[str] = []
    orders: list[tuple[str, str, float, float | None]] = []  # (lado, ativo, qtd, stop)

    # 2. saídas
    for t, df in data.items():
        q = broker.position_qty(t)
        if q == 0 or broker.has_pending(t):
            continue
        sig = strategy.decide(df, q) if q > 0 else strategy.decide(invert(df), -q)
        if sig.action == "VENDA":
            side: Side = "VENDA" if q > 0 else "COMPRA"
            broker.submit_order(t, side, abs(q), None, at=at)
            orders.append((side, t, abs(q), None))
            notes.append(f"zerou {t}: {sig.reason}")

    # 3. entradas nas vagas livres
    # vagas: TODAS as posições e ordens pendentes da conta (mesmo ativo sem dados hoje)
    busy = set(broker.active_tickers())
    slots = robot.max_positions - len(busy)
    if slots > 0:
        cands: dict[str, pd.DataFrame] = {}
        for t, df in data.items():
            if t in busy:
                continue
            if strategy.decide(df, 0).action == "COMPRA":
                cands[f"{t}|COMPRA"] = df
            elif futures and robot.short:
                inv = invert(df)
                if strategy.decide(inv, 0).action == "COMPRA":
                    cands[f"{t}|VENDA"] = inv
        for key in rank_candidates(robot.strategy.kind, cands):
            if slots <= 0:
                break
            t, side_txt = key.split("|")
            open_side: Side = "COMPRA" if side_txt == "COMPRA" else "VENDA"
            if futures:
                oid, blocked, qty, stop = _try_open(
                    ctx, robot, run_id, broker, data[t], at, open_side, ticker=t, marks=marks
                )
            else:
                oid, blocked, qty, stop = _try_buy(
                    ctx, robot, run_id, broker, data[t], at, ticker=t, marks=marks
                )
            if oid:
                orders.append((open_side, t, qty, stop))
                notes.append(f"abriu {open_side} {t}")
                slots -= 1
            elif blocked:
                notes.append(f"{t} bloqueado: {blocked}")
        if not cands:
            notes.append("nenhum ativo da lista com sinal de entrada")
    elif not notes:
        notes.append(f"sem vagas ({robot.max_positions} posições/ordens em andamento)")

    broker.record_equity(at, marks)
    action = orders[0][0] if orders else "ESPERA"
    rationale = (f"varredura de {len(data)}/{len(robot.universe)} ativos · " + "; ".join(notes))[
        :600
    ]
    await publish(
        "decision",
        {
            "action": action,
            "ticker": ", ".join(o[1] for o in orders) or "VARREDURA",
            "qty": orders[0][2] if orders else 0,
            "stop": orders[0][3] if orders else None,
            "rationale": rationale,
        },
    )
    snap = broker.portfolio(marks)
    await publish(
        "portfolio_update",
        {
            "cash": snap.cash,
            "equity": snap.equity,
            "initial_cash": snap.initial_cash,
            "positions": [
                {
                    "ticker": p.ticker,
                    "qty": p.qty,
                    "avg_price": p.avg_price,
                    "stop": p.stop,
                    "mark": p.mark,
                    "pnl": p.pnl,
                }
                for p in snap.positions
            ],
        },
    )
    first_order = None  # ordens ficam no histórico da conta; o passo resume no motivo
    return StepResult(robot.id, run_id, None, Signal(action, rationale), first_order, None)  # type: ignore[arg-type]
