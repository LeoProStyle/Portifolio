"""Executor de um ciclo de decisão completo.

1. `cycle_started`
2. Mercado: o PaperBroker processa candles novos (ordens pendentes e stops)
3. Monta a entrada dos agentes SÓ com dados <= clock.now() e confere isso
4. Roda o grafo LangGraph (Notícias ∥ Gráfico → Gestor → Risco → Gestor → Execução)
5. `portfolio_update` e `cycle_finished` (com tokens e custo)

Um ciclo por vez: a carteira simulada é compartilhada entre os tickers.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import pandas as pd

from app.agents.chart_agent import ChartAgent
from app.agents.manager_agent import ManagerFinalAgent, ManagerProposalAgent
from app.agents.news_agent import NewsAgent
from app.agents.risk_agent import RiskAgent
from app.agents.risk_rules import RiskLimits
from app.agents.schemas import Decision
from app.broker.base import Broker
from app.clock import Clock
from app.config import Settings
from app.data.news import NewsStore
from app.data.prices import PriceStore, available_at
from app.events import EventBus, make_event
from app.graph.workflow import CycleAgents, build_cycle_graph
from app.indicators.technical import summarize
from app.llm.budget import Usage
from app.llm.provider import LLMProvider

log = logging.getLogger(__name__)

INDICATORS_LOOKBACK_DAYS = 400
MARKET_LOOKBACK_DAYS = 30
NEWS_WINDOW = timedelta(days=7)


class LookAheadError(RuntimeError):
    """Algum dado com timestamp posterior ao instante simulado chegou aos agentes."""


def assert_no_future(state: dict[str, Any], now: datetime) -> None:
    last = (state.get("indicators") or {}).get("last_candle")
    if last:
        # compara o instante em que o candle FICA COMPLETO, não a abertura
        opened = pd.Timestamp(datetime.fromisoformat(last["time"]))
        ready = available_at(opened, state.get("interval", "1d"))
        if ready > pd.Timestamp(now):
            raise LookAheadError(
                f"candle de {last['time']} só fica completo em {ready.isoformat()}, "
                f"depois de {now.isoformat()}"
            )
    for item in state.get("news_items") or []:
        if datetime.fromisoformat(item["published"]) > now:
            raise LookAheadError(f"notícia de {item['published']} é posterior a {now.isoformat()}")


class CycleRunner:
    def __init__(
        self,
        *,
        settings: Settings,
        prices: PriceStore,
        news: NewsStore,
        broker: Broker,
        provider: LLMProvider,
        bus: EventBus,
        clock: Clock,
    ) -> None:
        self._settings = settings
        self._prices = prices
        self._news = news
        self._broker = broker
        self._provider = provider
        self._bus = bus
        self._clock = clock
        self._lock = asyncio.Lock()
        self.limits = RiskLimits(
            max_risk_per_trade=float(settings.max_risk_per_trade),
            max_position_pct=float(settings.max_position_pct),
            max_daily_loss=float(settings.max_daily_loss),
            atr_stop_mult=float(settings.atr_stop_mult),
            fee_pct=float(settings.fee_pct),
            slippage_pct=float(settings.slippage_pct),
        )

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    async def run(self, ticker: str, cycle_id: UUID) -> Decision | None:
        async with self._lock:
            return await self._run(ticker, cycle_id)

    async def _run(self, ticker: str, cycle_id: UUID) -> Decision | None:
        started = time.perf_counter()
        usage = Usage(
            price_per_mtok_input=float(self._settings.price_per_mtok_input),
            price_per_mtok_output=float(self._settings.price_per_mtok_output),
            billable=self._provider.name != "mock",
        )

        async def emit(type_: str, payload: dict[str, Any]) -> None:
            await self._bus.publish(make_event(type_, cycle_id, payload))

        decision: Decision | None = None
        try:
            await emit("cycle_started", {"ticker": ticker})
            now = self._clock.now()
            marks = await self._process_market(now, ticker, emit)
            state = await self._build_state(ticker, now, marks)
            assert_no_future(state, now)

            async def execute(d: Decision) -> str | None:
                await emit("decision", d.model_dump(mode="json"))
                if d.action == "ESPERA" or d.qty == 0:
                    return None
                order = self._broker.submit_order(
                    ticker, d.action, d.qty, d.stop, at=now, cycle_id=str(cycle_id)
                )
                return order.id

            agents = CycleAgents(
                news=NewsAgent(self._provider, emit, usage),
                chart=ChartAgent(self._provider, emit, usage),
                proposal=ManagerProposalAgent(self._provider, emit, usage),
                risk=RiskAgent(self._provider, emit, usage),
                final=ManagerFinalAgent(self._provider, emit, usage),
            )
            result = await build_cycle_graph(agents, execute).ainvoke(state)
            decision = result["decision"]

            self._broker.record_equity(now, marks)
            await emit("portfolio_update", self.portfolio_payload(marks))
        except Exception as exc:
            log.exception("Ciclo %s falhou", cycle_id)
            usage.errors.append(repr(exc)[:300])
            await emit(
                "agent_message",
                {"agent": "manager", "text": f"Ciclo interrompido por erro: {exc!r}"[:500]},
            )
        finally:
            await emit(
                "cycle_finished",
                {
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "tokens": usage.tokens,
                    "cost": round(usage.cost, 6),
                },
            )
        return decision

    async def _process_market(self, now: datetime, ticker: str, emit: Any) -> dict[str, float]:
        """Executa ordens pendentes e stops com os candles novos; devolve os preços de marcação."""
        marks: dict[str, float] = {}
        for t in sorted(self._broker.active_tickers() | {ticker}):
            candles = await asyncio.to_thread(
                self._prices.get_candles, t, now, MARKET_LOOKBACK_DAYS, "1d"
            )
            if candles.empty:
                continue
            for fill in self._broker.process_candles(t, candles):
                await emit(
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
            marks[t] = float(candles["close"].iloc[-1])
        return marks

    async def _build_state(
        self, ticker: str, now: datetime, marks: dict[str, float]
    ) -> dict[str, Any]:
        candles = await asyncio.to_thread(
            self._prices.get_candles, ticker, now, INDICATORS_LOOKBACK_DAYS, "1d"
        )
        indicators = summarize(candles)
        price = indicators["last_candle"]["close"] if indicators["last_candle"] else None
        items = await asyncio.to_thread(self._news.get_news, ticker, now - NEWS_WINDOW, now)
        snap = self._broker.portfolio(marks)
        return {
            "ticker": ticker,
            "now": now,
            "news_items": [i.model_dump(mode="json") for i in items],
            "indicators": indicators,
            "price": price,
            "portfolio": {
                "cash": snap.cash,
                "equity": snap.equity,
                "position_qty": self._broker.position_qty(ticker),
                "daily_pnl_pct": round(self._broker.daily_pnl_pct(now, marks), 6),
            },
            "limits": self.limits,
        }

    def portfolio_payload(self, marks: dict[str, float]) -> dict[str, Any]:
        snap = self._broker.portfolio(marks)
        return {
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
        }
