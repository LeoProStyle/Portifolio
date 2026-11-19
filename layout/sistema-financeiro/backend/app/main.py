"""FastAPI: rotas REST e WebSocket.

Rodar: uv run uvicorn app.main:create_app --factory --reload --port 8000
"""

import asyncio
import contextlib
import logging
import time
import uuid
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import Engine
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.backtest.routes import build_backtest_router
from app.broker.base import Broker, create_broker
from app.clock import Clock, RealClock
from app.config import Settings, get_settings
from app.cycle import CycleRunner
from app.data.news import FeedFetcher, HttpFeedFetcher, NewsStore
from app.data.prices import PriceFetcher, PriceStore, YFinanceFetcher
from app.db.models import make_engine
from app.engine.office_risk import OfficeRisk
from app.engine.scheduler import build_scheduler, catch_up_all
from app.engine.step import EngineContext, load_candles
from app.event_store import EventStore
from app.events import EventBus
from app.indicators.technical import sma, summarize
from app.llm.provider import LLMProvider, create_provider
from app.office import fx
from app.office.accounts import AccountRegistry, broker_terms, contract_specs
from app.office.config import OFFICE_DEFAULT, OfficeConfig, load_office
from app.office.routes import build_office_router, order_json

log = logging.getLogger("trading_room")

MESA_IA_ID = "mesa-ia"

# histórico extra buscado só para as médias da borda esquerda do gráfico
WARMUP_DAYS = {"1d": 90, "1h": 15}
INDICATORS_LOOKBACK_DAYS = 400


class CycleRequest(BaseModel):
    ticker: str


class CycleAccepted(BaseModel):
    cycle_id: uuid.UUID
    ticker: str


@dataclass
class Runtime:
    """Todas as peças do sistema, montadas uma vez (facilita testes)."""

    settings: Settings
    engine: Engine
    clock: Clock
    prices: PriceStore
    news: NewsStore
    broker: Broker  # conta do robô mesa-ia (a equipe de agentes de IA)
    bus: EventBus
    events: EventStore
    runner: CycleRunner
    office: OfficeConfig
    accounts: AccountRegistry
    office_risk: OfficeRisk
    engine_ctx: EngineContext  # motor dos robôs (passo, catch-up, agendador)


def build_runtime(
    settings: Settings,
    *,
    price_fetcher: PriceFetcher | None = None,
    feed_fetcher: FeedFetcher | None = None,
    clock: Clock | None = None,
    provider: LLMProvider | None = None,
    wall_clock: Callable[[], float] | None = None,
) -> Runtime:
    clock = clock or RealClock()
    engine = make_engine(settings.database_url)
    # relógio de parede do cache (quando os dados foram baixados); testes com
    # relógio simulado no futuro passam um coerente com a simulação
    prices = PriceStore(
        engine, price_fetcher or YFinanceFetcher(), wall_clock=wall_clock or time.time
    )
    news = NewsStore(engine, feed_fetcher or HttpFeedFetcher(), settings.news_feeds)
    office = load_office(
        Path(settings.office_config) if settings.office_config else OFFICE_DEFAULT,
        tickers=settings.tickers,
    )
    accounts = AccountRegistry(
        engine,
        fee_pct=float(settings.fee_pct),
        slippage_pct=float(settings.slippage_pct),
        contracts=contract_specs(office),
        terms=broker_terms(office),
    )
    mesa = office.robot(MESA_IA_ID)
    if mesa is not None:
        broker = accounts.broker_for(accounts.live_run(mesa, clock.now()))
    else:  # escritório sem Mesa IA: o ciclo manual usa uma conta avulsa
        broker = create_broker(settings, engine)
    events = EventStore(engine)
    bus = EventBus(recorder=events.record)
    runner = CycleRunner(
        settings=settings,
        prices=prices,
        news=news,
        broker=broker,
        provider=provider or create_provider(settings),
        bus=bus,
        clock=clock,
    )
    office_risk = OfficeRisk(
        engine, office, accounts, fx_rate=lambda cur, at: fx.rate_for(prices, cur, at)
    )
    engine_ctx = EngineContext(
        settings=settings,
        prices=prices,
        accounts=accounts,
        office=office,
        bus=bus,
        clock=clock,
        office_risk=office_risk,
        mesa_cycle=lambda ticker: runner.run(ticker, uuid.uuid4()),
    )
    return Runtime(
        settings,
        engine,
        clock,
        prices,
        news,
        broker,
        bus,
        events,
        runner,
        office,
        accounts,
        office_risk,
        engine_ctx,
    )


def _series_points(series: pd.Series) -> list[dict[str, Any]]:
    return [
        {"time": ts.isoformat(), "value": round(float(v), 4)}
        for ts, v in series.items()
        if not pd.isna(v)
    ]


def create_app(
    settings: Settings | None = None,
    *,
    price_fetcher: PriceFetcher | None = None,
    feed_fetcher: FeedFetcher | None = None,
    clock: Clock | None = None,
    provider: LLMProvider | None = None,
    start_scheduler: bool = True,
) -> FastAPI:
    """Monta o app. Testes passam `start_scheduler=False` (sem robôs automáticos)."""
    settings = settings or get_settings()
    rt = build_runtime(
        settings,
        price_fetcher=price_fetcher,
        feed_fetcher=feed_fetcher,
        clock=clock,
        provider=provider,
    )
    tasks: set[asyncio.Task[Any]] = set()
    allowed_tickers = [*settings.tickers, settings.benchmark]

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.scheduler = None
        if not start_scheduler:
            yield
            return
        # recuperação em segundo plano: baixar candles pode demorar e não
        # deve travar a subida do servidor
        recovery = asyncio.create_task(catch_up_all(rt.engine_ctx))
        sched = build_scheduler(rt.engine_ctx)
        sched.start()
        app.state.scheduler = sched
        try:
            yield
        finally:
            sched.shutdown(wait=False)
            recovery.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await recovery

    app = FastAPI(title="Sala de Operações (simulação)", version="0.4.0", lifespan=lifespan)
    app.state.runtime = rt
    app.state.scheduler = None
    app.state.backtest_lock = asyncio.Lock()
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[*settings.allowed_hosts, "testserver"],
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    app.include_router(
        build_office_router(
            engine=rt.engine,
            clock=rt.clock,
            office=rt.office,
            accounts=rt.accounts,
            office_risk=rt.office_risk,
            # só o cache: a lista de robôs não busca preços na rede a cada recarga
            candles_for=lambda robot, at, days, ticker: load_candles(
                rt.engine_ctx, robot, at, days, refresh=False, ticker=ticker
            ),
        )
    )
    app.include_router(build_backtest_router(rt.engine_ctx, app.state.backtest_lock))

    def check_ticker(ticker: str) -> None:
        if ticker not in allowed_tickers:
            raise HTTPException(404, f"Ticker não configurado. Use um de: {allowed_tickers}")

    def current_marks() -> dict[str, float]:
        now = rt.clock.now()
        marks = {}
        for t in rt.broker.active_tickers():
            df = rt.prices.get_candles(t, until=now, lookback_days=10)
            if not df.empty:
                marks[t] = float(df["close"].iloc[-1])
        return marks

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "mode": "paper",
            "live_trading_enabled": settings.live_trading_enabled,
            "llm_provider": settings.llm_provider,
            "tickers": settings.tickers,
            "benchmark": settings.benchmark,
            "ws_clients": rt.bus.subscriber_count,
            "cycle_running": rt.runner.busy,
        }

    # ---------- dados (rotas síncronas: o FastAPI roda em threadpool) ----------

    @app.get("/api/prices/{ticker}")
    def get_prices(
        ticker: str,
        interval: Literal["1d", "1h"] = "1d",
        days: int = Query(180, ge=5, le=730),
    ) -> dict[str, Any]:
        check_ticker(ticker)
        now = rt.clock.now()
        df = rt.prices.get_candles(
            ticker, until=now, lookback_days=days + WARMUP_DAYS[interval], interval=interval
        )
        visible = df.index >= pd.Timestamp(now - timedelta(days=days))
        shown = df[visible]
        return {
            "ticker": ticker,
            "interval": interval,
            "as_of": now.isoformat(),
            "candles": [
                {
                    "time": ts.isoformat(),
                    "open": round(float(r["open"]), 4),
                    "high": round(float(r["high"]), 4),
                    "low": round(float(r["low"]), 4),
                    "close": round(float(r["close"]), 4),
                    "volume": float(r["volume"]),
                }
                for ts, r in shown.iterrows()
            ],
            "sma20": _series_points(sma(df["close"], 20)[visible]),
            "sma50": _series_points(sma(df["close"], 50)[visible]),
        }

    @app.get("/api/indicators/{ticker}")
    def get_indicators(ticker: str, interval: Literal["1d", "1h"] = "1d") -> dict[str, Any]:
        check_ticker(ticker)
        now = rt.clock.now()
        lookback = INDICATORS_LOOKBACK_DAYS if interval == "1d" else 60
        df = rt.prices.get_candles(ticker, until=now, lookback_days=lookback, interval=interval)
        return {"ticker": ticker, "interval": interval, "as_of": now.isoformat(), **summarize(df)}

    @app.get("/api/news/{ticker}")
    def get_news(ticker: str, days: int = Query(7, ge=1, le=30)) -> dict[str, Any]:
        check_ticker(ticker)
        now = rt.clock.now()
        items = rt.news.get_news(ticker, since=now - timedelta(days=days), until=now)
        return {
            "ticker": ticker,
            "as_of": now.isoformat(),
            "items": [i.model_dump(mode="json") for i in items],
        }

    # ---------- ciclo de decisão ----------

    @app.post("/api/cycle", status_code=202)
    async def start_cycle(req: CycleRequest) -> CycleAccepted:
        if req.ticker not in settings.tickers:
            raise HTTPException(422, f"Ticker fora da lista configurada: {settings.tickers}")
        if rt.runner.busy:
            raise HTTPException(409, "Já existe um ciclo em andamento. Aguarde terminar.")
        cycle_id = uuid.uuid4()
        task = asyncio.create_task(rt.runner.run(req.ticker, cycle_id))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        return CycleAccepted(cycle_id=cycle_id, ticker=req.ticker)

    # ---------- carteira simulada ----------

    @app.get("/api/portfolio")
    def get_portfolio() -> dict[str, Any]:
        marks = current_marks()
        now = rt.clock.now()
        return {
            **rt.runner.portfolio_payload(marks),
            "daily_pnl_pct": round(rt.broker.daily_pnl_pct(now, marks), 6),
            "pending_orders": [order_json(o) for o in rt.broker.list_orders(status="pending")],
            "as_of": now.isoformat(),
        }

    @app.get("/api/orders")
    def get_orders(
        ticker: str | None = None,
        status: Literal["pending", "filled", "rejected"] | None = None,
        limit: int = Query(100, ge=1, le=500),
    ) -> dict[str, Any]:
        if ticker:
            check_ticker(ticker)
        orders = rt.broker.list_orders(ticker=ticker, status=status, limit=limit)
        return {"orders": [order_json(o) for o in orders]}

    @app.get("/api/events")
    def get_events(limit: int = Query(300, ge=1, le=2000)) -> dict[str, Any]:
        """Histórico da linha do tempo (fonte de verdade), do mais antigo ao mais recente."""
        return {"events": rt.events.recent(limit)}

    # ---------- WebSocket ----------

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        # SEC-001: navegador sempre manda Origin; bloqueia páginas de outros sites
        # (Cross-Site WebSocket Hijacking). Sem Origin = cliente local (CLI/teste).
        origin = websocket.headers.get("origin")
        if origin is not None and origin not in settings.cors_origins:
            await websocket.close(code=1008)
            return
        await websocket.accept()
        async with rt.bus.subscribe() as queue:

            async def sender() -> None:
                while True:
                    event = await queue.get()
                    await websocket.send_text(event.model_dump_json())

            async def receiver() -> None:
                # o cliente não envia comandos por aqui; só detectamos a desconexão
                with contextlib.suppress(WebSocketDisconnect):
                    while True:
                        await websocket.receive_text()

            send_task = asyncio.create_task(sender())
            recv_task = asyncio.create_task(receiver())
            done, pending = await asyncio.wait(
                {send_task, recv_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, WebSocketDisconnect):
                    log.warning("WebSocket encerrado com erro: %r", exc)

    _mount_frontend(app, settings)
    return app


def _mount_frontend(app: FastAPI, settings: Settings) -> None:
    """Serve a tela compilada em `/` (depois de todas as rotas: /api e /ws têm prioridade).

    Assim um único processo (o que liga com o Windows) entrega API, WebSocket e tela.
    Sem `frontend/dist`, o backend sobe só com a API.
    """
    dist = (
        Path(settings.frontend_dist)
        if settings.frontend_dist
        else Path(__file__).resolve().parents[2] / "frontend" / "dist"
    )
    if not (dist / "index.html").is_file():
        return

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(path: str) -> None:
        # rota de API inexistente continua 404 (não cai na tela)
        raise HTTPException(status_code=404, detail=f"Rota /api/{path} não existe")

    app.mount("/", StaticFiles(directory=dist, html=True), name="tela")
