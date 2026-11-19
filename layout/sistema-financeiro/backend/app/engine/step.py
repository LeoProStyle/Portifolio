"""Um passo de decisão de um robô, num instante `at`.

1. Conta do robô (execução ao vivo da configuração atual).
2. Mercado: o broker processa candles completos até `at` (ordens pendentes, stop e alvo).
3. Sinal da estratégia SÓ com candles já fechados em `at` (sem look-ahead).
4. Venda: sempre permitida (saída nunca é bloqueada).
   Compra: limite de operações do dia, liquidez, risco do escritório,
   stop/alvo pelo plano de saída e tamanho pelo risco do robô.
5. Registra patrimônio e emite eventos com `room` e `robot_id`.
"""

import asyncio
import dataclasses
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

import pandas as pd

from app.agents.risk_rules import RiskLimits, size_buy
from app.broker.futures import FuturesBroker
from app.clock import Clock
from app.config import Settings
from app.data.instruments import InstrumentFeed
from app.data.prices import PriceStore, available_at
from app.engine.common import Decision, trades_today
from app.engine.futures import futures_decision
from app.events import EventBus, make_event
from app.indicators.technical import atr
from app.office.accounts import AccountRegistry
from app.office.config import OfficeConfig, RobotConfig
from app.strategies import Signal, build_strategy
from app.strategies.exits import plan_exit

log = logging.getLogger(__name__)

LOOKBACK_DAYS = {"1d": 400, "1h": 60}


class OfficeGate(Protocol):
    """Risco do escritório (Gerente Geral). Implementado em engine/office_risk.py."""

    def allows_new_orders(
        self,
        room: str,
        ticker: str,
        at: datetime,
        extra_exposure: float,
        robot_id: str | None = None,
    ) -> tuple[bool, str | None]: ...


class AllowAll:
    def allows_new_orders(
        self,
        room: str,
        ticker: str,
        at: datetime,
        extra_exposure: float,
        robot_id: str | None = None,
    ) -> tuple[bool, str | None]:
        return True, None


@dataclass
class EngineContext:
    settings: Settings
    prices: PriceStore
    accounts: AccountRegistry
    office: OfficeConfig
    bus: EventBus
    clock: Clock
    office_risk: OfficeGate
    # ciclo da Mesa IA (equipe de agentes); recebe o ticker
    mesa_cycle: Callable[[str], Awaitable[Any]] | None = None
    # uma trava por robô: recuperação ao ligar e job agendado nunca decidem juntos
    robot_locks: dict[str, asyncio.Lock] = field(default_factory=dict)

    def robot_lock(self, robot_id: str) -> asyncio.Lock:
        return self.robot_locks.setdefault(robot_id, asyncio.Lock())

    @property
    def limits(self) -> RiskLimits:
        s = self.settings
        return RiskLimits(
            max_risk_per_trade=float(s.max_risk_per_trade),
            max_position_pct=float(s.max_position_pct),
            max_daily_loss=float(s.max_daily_loss),
            atr_stop_mult=float(s.atr_stop_mult),
            fee_pct=float(s.fee_pct),
            slippage_pct=float(s.slippage_pct),
        )


@dataclass(frozen=True)
class StepResult:
    robot_id: str
    run_id: str
    candle_ts: str | None
    signal: Signal
    order_id: str | None = None
    blocked_reason: str | None = None


def source_ticker(office: OfficeConfig, robot: RobotConfig, ticker: str | None = None) -> str:
    """Ticker de onde vêm os candles (minicontrato → proxy, ex.: WIN → ^BVSP)."""
    t = ticker or robot.ticker
    inst = office.instrument(t)
    return inst.source if inst is not None else t


def load_candles(
    ctx: EngineContext,
    robot: RobotConfig,
    until: datetime,
    lookback_days: int,
    refresh: bool = True,
    ticker: str | None = None,
) -> pd.DataFrame:
    """Candles do ativo (padrão: o do robô) completos em `until` (instrumento: proxy em pontos)."""
    t = ticker or robot.ticker
    inst = ctx.office.instrument(t)
    if inst is not None:
        return InstrumentFeed(ctx.prices).get_candles(
            inst, until=until, lookback_days=lookback_days, interval=robot.interval, refresh=refresh
        )
    return ctx.prices.get_candles(
        t,
        until=until,
        lookback_days=lookback_days,
        interval=robot.interval,
        refresh=refresh,
    )


async def robot_step(ctx: EngineContext, robot: RobotConfig, at: datetime) -> StepResult:
    """Passo ao vivo: conta da execução "live" + candles do banco/yfinance."""
    run_id = ctx.accounts.live_run(robot, at)
    if robot.universe:  # rastreador: escolhe entre vários ativos
        from app.engine.scanner import scanner_step

        return await scanner_step(ctx, robot, run_id, at)
    candles = load_candles(ctx, robot, at, LOOKBACK_DAYS[robot.interval])
    return await decide_step(ctx, robot, run_id, candles, at)


async def decide_step(
    ctx: EngineContext,
    robot: RobotConfig,
    run_id: str,
    candles: pd.DataFrame,
    at: datetime,
    *,
    emit: bool = True,
) -> StepResult:
    """Núcleo do passo, igual no ao vivo e no backtest (só muda a conta e os candles)."""
    broker = ctx.accounts.broker_for(run_id)
    room, rid = robot.room, robot.id

    async def publish(type_: str, payload: dict[str, Any]) -> None:
        if emit:
            await ctx.bus.publish(make_event(type_, None, payload, room=room, robot_id=rid))

    # garantia extra contra look-ahead: só candles completos em `at`
    if not candles.empty:
        src = source_ticker(ctx.office, robot)
        ready = [available_at(ts, robot.interval, src) <= pd.Timestamp(at) for ts in candles.index]
        candles = candles[ready]

    for fill in broker.process_candles(robot.ticker, candles):
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

    candle_ts = candles.index[-1].isoformat() if not candles.empty else None
    marks = {robot.ticker: float(candles["close"].iloc[-1])} if not candles.empty else {}

    if robot.strategy.kind == "mesa_ia":
        if ctx.mesa_cycle is not None:
            await ctx.mesa_cycle(robot.ticker)
        return StepResult(rid, run_id, candle_ts, Signal("ESPERA", "ciclo da Mesa IA"))

    if isinstance(broker, FuturesBroker):
        d = futures_decision(ctx, robot, run_id, broker, candles, at)
    else:
        d = _stock_decision(ctx, robot, run_id, broker, candles, at)

    broker.record_equity(at, marks)
    rationale = d.signal.reason + (f" | bloqueado: {d.blocked}" if d.blocked else "")
    await publish(
        "decision",
        {
            "action": d.action if d.order_id else "ESPERA",
            "ticker": robot.ticker,
            "qty": d.qty if d.order_id else 0,
            "stop": d.stop if d.order_id else None,
            "rationale": rationale[:600],
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
    return StepResult(rid, run_id, candle_ts, d.signal, d.order_id, d.blocked)


def _stock_decision(
    ctx: EngineContext,
    robot: RobotConfig,
    run_id: str,
    broker: Any,
    candles: pd.DataFrame,
    at: datetime,
) -> Decision:
    """Ações: só comprado. Venda zera a posição e nunca é bloqueada."""
    if broker.has_pending(robot.ticker):
        # dados com atraso (cripto/24h): a ordem anterior ainda não executou; não repetir
        return Decision(Signal("ESPERA", "ordem pendente aguardando execução"), "ESPERA")
    position = broker.position_qty(robot.ticker)
    signal = build_strategy(robot.strategy).decide(candles, position)
    if signal.action == "VENDA" and position > 0:
        order_id = broker.submit_order(robot.ticker, "VENDA", position, None, at=at).id
        return Decision(signal, "VENDA", order_id, None, position, None)
    if signal.action == "COMPRA" and position == 0:
        order_id, blocked, qty, stop = _try_buy(ctx, robot, run_id, broker, candles, at)
        return Decision(signal, "COMPRA", order_id, blocked, qty, stop)
    return Decision(signal, "ESPERA")


def _try_buy(
    ctx: EngineContext,
    robot: RobotConfig,
    run_id: str,
    broker: Any,
    candles: pd.DataFrame,
    at: datetime,
    ticker: str | None = None,
    marks: dict[str, float] | None = None,
) -> tuple[str | None, str | None, int, float | None]:
    ticker = ticker or robot.ticker
    if trades_today(ctx.accounts.engine, run_id, at) >= robot.max_trades_per_day:
        return None, f"limite de {robot.max_trades_per_day} operações no dia", 0, None
    avg_volume = float(candles["volume"].iloc[-20:].mean())
    if avg_volume < robot.min_avg_volume:
        return None, f"liquidez baixa: volume médio {avg_volume:,.0f}", 0, None
    price = float(candles["close"].iloc[-1])
    a = float(atr(candles["high"], candles["low"], candles["close"], 14).iloc[-1])
    try:
        plan = plan_exit(price, a, atr_mult=float(ctx.settings.atr_stop_mult))
    except ValueError as exc:
        return None, f"plano de saída inválido: {exc}", 0, None
    # todas as posições marcadas (rastreador tem várias), o ativo novo pelo preço atual
    all_marks = {**(marks or {}), ticker: price}
    snap = broker.portfolio(all_marks)
    # custos da conta (a sala pode ter os seus, ex.: cripto 0,1%)
    limits = dataclasses.replace(
        ctx.limits, fee_pct=broker.fee_pct, slippage_pct=broker.slippage_pct
    )
    daily = broker.daily_pnl_pct(at, all_marks)
    if daily <= -limits.max_daily_loss:
        return (
            None,
            (
                f"Veto: perda diária de {daily:.2%} atingiu o limite de "
                f"{limits.max_daily_loss:.0%}. Nada opera até o próximo dia."
            ),
            0,
            None,
        )
    size = size_buy(
        price=price,
        atr=a,
        equity=snap.equity,
        cash=snap.cash,
        position_qty=0,
        limits=limits,
        qty_step=broker.qty_step,
    )
    qty = int(size.qty) if broker.qty_step == 1 else size.qty
    if qty <= 0:
        return None, size.notes, 0, None
    ok, why = ctx.office_risk.allows_new_orders(
        robot.room, ticker, at, qty * price, robot_id=robot.id
    )
    if not ok:
        return None, why, 0, None
    order = broker.submit_order(ticker, "COMPRA", qty, plan.stop, at=at, target=plan.target)
    return order.id, None, qty, plan.stop
