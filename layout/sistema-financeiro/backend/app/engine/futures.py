"""Passo de um robô de minicontratos (comprado E vendido), em paper trading.

- Sinal: a estratégia na série real (lado comprado) e na série invertida
  (lado vendido), combinadas por `combine` (só abre a partir de zerado).
- Zerar nunca é bloqueado. Abrir passa por: limite de operações do dia,
  liquidez, plano de saída do lado certo, tamanho em contratos (risco e margem)
  e risco do escritório (exposição medida em margem).
"""

from datetime import datetime
from typing import TYPE_CHECKING

import pandas as pd

from app.broker.base import Side
from app.broker.futures import FuturesBroker
from app.engine.common import Decision, trades_today
from app.indicators.technical import atr
from app.office.config import RobotConfig
from app.strategies import Signal, build_strategy
from app.strategies.exits import plan_exit
from app.strategies.sides import combine, invert, size_contracts

if TYPE_CHECKING:
    from app.engine.step import EngineContext


def futures_decision(
    ctx: "EngineContext",
    robot: RobotConfig,
    run_id: str,
    broker: FuturesBroker,
    candles: pd.DataFrame,
    at: datetime,
) -> Decision:
    ticker = robot.ticker
    if broker.has_pending(ticker):
        # câmbio de 24h: a ordem de ontem só executa depois; não repetir (dobraria o risco)
        return Decision(Signal("ESPERA", "ordem pendente aguardando execução"), "ESPERA")
    position = broker.position_qty(ticker)
    strategy = build_strategy(robot.strategy)
    long_sig = strategy.decide(candles, max(position, 0))
    short_sig = (
        strategy.decide(invert(candles), max(-position, 0))
        if robot.short and not candles.empty
        else None
    )
    intent = combine(position, long_sig, short_sig)

    if intent.kind == "zerar":
        close_side: Side = "VENDA" if position > 0 else "COMPRA"
        order = broker.submit_order(ticker, close_side, abs(position), None, at=at)
        signal = Signal(close_side, intent.reason)
        return Decision(signal, close_side, order.id, None, abs(position))

    if intent.kind == "esperar":
        return Decision(Signal("ESPERA", intent.reason), "ESPERA")

    side: Side = "COMPRA" if intent.kind == "comprar" else "VENDA"
    order_id, blocked, qty, stop = _try_open(ctx, robot, run_id, broker, candles, at, side)
    return Decision(Signal(side, intent.reason), side, order_id, blocked, qty, stop)


def _max_risk(ctx: "EngineContext", robot: RobotConfig) -> float:
    """Risco por operação: o da sala (se definido no office.yaml) ou o do .env."""
    room = ctx.office.room(robot.room)
    if room is not None and room.max_risk_per_trade is not None:
        return float(room.max_risk_per_trade)
    return float(ctx.settings.max_risk_per_trade)


def _try_open(
    ctx: "EngineContext",
    robot: RobotConfig,
    run_id: str,
    broker: FuturesBroker,
    candles: pd.DataFrame,
    at: datetime,
    side: Side,
    ticker: str | None = None,
    marks: dict[str, float] | None = None,
) -> tuple[str | None, str | None, int, float | None]:
    ticker = ticker or robot.ticker
    spec = broker.spec_for(ticker)
    if trades_today(ctx.accounts.engine, run_id, at) >= robot.max_trades_per_day:
        return None, f"limite de {robot.max_trades_per_day} operações no dia", 0, None
    avg_volume = float(candles["volume"].iloc[-20:].mean())
    if avg_volume < robot.min_avg_volume:
        return None, f"liquidez baixa: volume médio {avg_volume:,.0f}", 0, None
    price = float(candles["close"].iloc[-1])
    a = float(atr(candles["high"], candles["low"], candles["close"], 14).iloc[-1])
    try:
        plan = plan_exit(price, a, atr_mult=float(ctx.settings.atr_stop_mult), side=side)
    except ValueError as exc:
        return None, f"plano de saída inválido: {exc}", 0, None
    marks = {**(marks or {}), ticker: price}  # todas as posições marcadas
    snap = broker.portfolio(marks)
    qty, notes = size_contracts(
        snap.equity,
        snap.equity - broker.margin_used(),
        price,
        plan.stop,
        spec,
        _max_risk(ctx, robot),
        broker.daily_pnl_pct(at, marks),
        float(ctx.settings.max_daily_loss),
    )
    if qty <= 0:
        return None, f"nenhum contrato cabe: {notes}", 0, None
    ok, why = ctx.office_risk.allows_new_orders(
        robot.room, ticker, at, qty * spec.margin_per_contract, robot_id=robot.id
    )
    if not ok:
        return None, why, 0, None
    order = broker.submit_order(ticker, side, qty, plan.stop, at=at, target=plan.target)
    return order.id, None, qty, plan.stop
