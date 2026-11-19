"""Rotas de dados da Fase 2: preços, indicadores e notícias (sem rede)."""

from datetime import datetime

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.main import create_app
from tests.test_news import RSS


class FakePrices:
    def fetch(self, ticker: str, start: datetime, end: datetime, interval: str) -> pd.DataFrame:
        idx = pd.date_range("2026-05-01", "2026-11-18", freq="B", tz=TZ_BRASILIA)
        closes = np.linspace(30, 40, len(idx))
        return pd.DataFrame(
            {"open": closes, "high": closes + 1, "low": closes - 1, "close": closes, "volume": 1e6},
            index=idx,
        )


class FakeFeeds:
    def fetch(self, url: str) -> bytes:
        return RSS


@pytest.fixture
def client() -> TestClient:
    settings = Settings(_env_file=None, database_url="sqlite://")
    clock = SimulatedClock(datetime(2026, 11, 18, 14, 0, tzinfo=TZ_BRASILIA))
    app = create_app(
        settings,
        price_fetcher=FakePrices(),
        feed_fetcher=FakeFeeds(),
        clock=clock,
        start_scheduler=False,
    )
    with TestClient(app) as c:
        yield c


def test_prices_retorna_candles_e_medias(client: TestClient) -> None:
    body = client.get("/api/prices/PETR4.SA", params={"days": 60}).json()
    assert body["ticker"] == "PETR4.SA"
    assert body["interval"] == "1d"
    candles = body["candles"]
    assert candles, "deveria haver candles"
    # instante simulado: 18/11 14h -> o candle de 18/11 ainda não fechou
    assert candles[-1]["time"].startswith("2026-11-17")
    assert set(candles[0]) == {"time", "open", "high", "low", "close", "volume"}
    # médias calculadas no backend, alinhadas aos candles exibidos
    assert body["sma20"] and body["sma50"]
    assert body["sma20"][-1]["time"] == candles[-1]["time"]


def test_indicators_resumo(client: TestClient) -> None:
    body = client.get("/api/indicators/PETR4.SA").json()
    assert body["as_of"].startswith("2026-11-18T14:00:00")
    assert body["last_candle"]["time"].startswith("2026-11-17")
    for chave in ("sma20", "sma50", "ema9", "rsi14", "atr14", "vol20", "macd"):
        assert chave in body


def test_news_sem_look_ahead(client: TestClient) -> None:
    body = client.get("/api/news/PETR4.SA", params={"days": 7}).json()
    links = [i["link"] for i in body["items"]]
    assert links == ["https://exemplo.com/1"]  # o item 2 é posterior ao instante simulado


def test_benchmark_e_permitido(client: TestClient) -> None:
    assert client.get("/api/prices/^BVSP").status_code == 200


@pytest.mark.parametrize("rota", ["/api/prices/XYZ", "/api/indicators/XYZ", "/api/news/XYZ"])
def test_ticker_desconhecido_404(client: TestClient, rota: str) -> None:
    assert client.get(rota).status_code == 404


def test_parametros_fora_do_limite(client: TestClient) -> None:
    assert client.get("/api/prices/PETR4.SA", params={"days": 5000}).status_code == 422
    assert client.get("/api/prices/PETR4.SA", params={"interval": "1m"}).status_code == 422
    assert client.get("/api/news/PETR4.SA", params={"days": 90}).status_code == 422
