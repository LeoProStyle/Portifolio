"""Agentes: JSON inválido → nova tentativa → resultado neutro (seções 6 e 15)."""

import asyncio
import json
from datetime import datetime
from typing import Any

from app.agents.base import extract_json
from app.agents.chart_agent import ChartAgent
from app.agents.news_agent import NewsAgent
from app.clock import TZ_BRASILIA
from app.llm.budget import Usage
from app.llm.provider import LLMResponse

NOW = datetime(2026, 11, 18, 14, 0, tzinfo=TZ_BRASILIA)
HEADLINES = [
    {
        "title": "Petrobras aprova dividendos",
        "source": "Valor",
        "published": "2026-11-17T10:00:00-03:00",
        "link": "https://exemplo.com/1",
    }
]
VALID_NEWS = json.dumps(
    {
        "ticker": "PETR4.SA",
        "sentiment": 0.4,
        "confidence": 0.5,
        "key_points": ["dividendos aprovados"],
        "sources": ["https://exemplo.com/1"],
    }
)


class ScriptedProvider:
    """Devolve as respostas na ordem dada."""

    name = "fake"

    def __init__(self, *texts: str) -> None:
        self.texts = list(texts)
        self.calls = 0

    async def complete(self, *, agent: str, system: str, user: str) -> LLMResponse:
        self.calls += 1
        return LLMResponse(self.texts.pop(0), 10, 5)


class Recorder:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, type_: str, payload: dict[str, Any]) -> None:
        self.events.append((type_, payload))

    def statuses(self) -> list[str]:
        return [p["status"] for t, p in self.events if t == "agent_status"]


def _state(**extra: Any) -> dict[str, Any]:
    return {"ticker": "PETR4.SA", "now": NOW, "news_items": HEADLINES, **extra}


def _run(agent: Any, state: dict[str, Any]) -> Any:
    return asyncio.run(agent.run(state))


def test_json_valido_na_primeira() -> None:
    provider, rec, usage = ScriptedProvider(VALID_NEWS), Recorder(), Usage()
    result = _run(NewsAgent(provider, rec, usage), _state())
    assert result.sentiment == 0.4
    assert provider.calls == 1
    assert usage.tokens == 15
    assert rec.statuses() == ["thinking", "done"]
    assert any(t == "agent_result" for t, _ in rec.events)


def test_json_invalido_tenta_de_novo() -> None:
    provider = ScriptedProvider("isso não é json", VALID_NEWS)
    result = _run(NewsAgent(provider, Recorder(), Usage()), _state())
    assert provider.calls == 2
    assert result.sentiment == 0.4


def test_duas_falhas_viram_resultado_neutro() -> None:
    provider, rec, usage = ScriptedProvider("{quebrado", '{"sentiment": 9}'), Recorder(), Usage()
    result = _run(NewsAgent(provider, rec, usage), _state())
    assert provider.calls == 2
    assert result.sentiment == 0 and result.confidence == 0
    assert rec.statuses() == ["thinking", "error"]
    assert usage.errors  # erro registrado


def test_schema_violado_conta_como_invalido() -> None:
    fora = json.dumps({"ticker": "PETR4.SA", "sentiment": 5, "confidence": 0.5})
    provider = ScriptedProvider(fora, VALID_NEWS)
    result = _run(NewsAgent(provider, Recorder(), Usage()), _state())
    assert provider.calls == 2 and result.sentiment == 0.4


def test_fonte_inventada_e_removida() -> None:
    inventada = json.loads(VALID_NEWS)
    inventada["sources"] = ["https://exemplo.com/1", "https://site-inventado.com/x"]
    result = _run(NewsAgent(ScriptedProvider(json.dumps(inventada)), Recorder(), Usage()), _state())
    assert result.sources == ["https://exemplo.com/1"]


def test_sem_noticias_nao_chama_o_llm() -> None:
    provider = ScriptedProvider()
    result = _run(NewsAgent(provider, Recorder(), Usage()), _state(news_items=[]))
    assert provider.calls == 0
    assert result.sentiment == 0 and result.confidence == 0


def test_sem_candles_grafico_neutro_sem_llm() -> None:
    provider = ScriptedProvider()
    result = _run(
        ChartAgent(provider, Recorder(), Usage()), _state(indicators={"last_candle": None})
    )
    assert provider.calls == 0
    assert result.trend == "lateral" and result.signal == 0


def test_ticker_sempre_do_ciclo() -> None:
    outro = json.loads(VALID_NEWS)
    outro["ticker"] = "VALE3.SA"
    result = _run(NewsAgent(ScriptedProvider(json.dumps(outro)), Recorder(), Usage()), _state())
    assert result.ticker == "PETR4.SA"


def test_extract_json_aceita_bloco_de_codigo() -> None:
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('Claro! {"a": 2} pronto') == {"a": 2}
