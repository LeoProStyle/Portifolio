"""Fontes de dados falsas (sem rede) usadas nos testes de ciclo e API."""

import json
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from app.clock import TZ_BRASILIA
from app.llm.mock import MockProvider
from app.llm.provider import LLMResponse
from tests.test_news import RSS

NOW = datetime(2026, 11, 18, 14, 0, tzinfo=TZ_BRASILIA)


class FakePrices:
    """Dias úteis de maio a 20/11/2026. `trend`: "alta" (zigue-zague subindo) ou "baixa".

    Devolve de propósito candles "do futuro" em relação a NOW: o PriceStore
    precisa filtrá-los (look-ahead).
    """

    def __init__(self, trend: str = "alta") -> None:
        self.trend = trend

    def fetch(self, ticker: str, start: datetime, end: datetime, interval: str) -> pd.DataFrame:
        idx = pd.date_range("2026-05-01", "2026-11-20", freq="B", tz=TZ_BRASILIA)
        base = (
            np.linspace(30, 40, len(idx)) if self.trend == "alta" else np.linspace(40, 30, len(idx))
        )
        wiggle = np.where(np.arange(len(idx)) % 2 == 0, 0.4, -0.4)  # IFR longe de 100
        closes = base + wiggle
        return pd.DataFrame(
            {
                "open": closes - 0.1,
                "high": closes + 0.6,
                "low": closes - 0.6,
                "close": closes,
                "volume": 1e6,
            },
            index=idx,
        )


class FakeFeeds:
    def fetch(self, url: str) -> bytes:
        return RSS


class SpyProvider(MockProvider):
    """MockProvider que guarda tudo o que cada agente recebeu."""

    def __init__(self) -> None:
        self.inputs: list[tuple[str, dict[str, Any]]] = []

    async def complete(self, *, agent: str, system: str, user: str) -> LLMResponse:
        self.inputs.append((agent, json.loads(user)))
        return await super().complete(agent=agent, system=system, user=user)


def iter_timestamps(value: Any) -> list[datetime]:
    """Todos os textos ISO 8601 com data encontrados numa estrutura JSON."""
    found: list[datetime] = []
    if isinstance(value, dict):
        for v in value.values():
            found += iter_timestamps(v)
    elif isinstance(value, list):
        for v in value:
            found += iter_timestamps(v)
    elif isinstance(value, str) and len(value) >= 19 and value[4] == "-" and "T" in value:
        try:
            found.append(datetime.fromisoformat(value))
        except ValueError:
            pass
    return found
