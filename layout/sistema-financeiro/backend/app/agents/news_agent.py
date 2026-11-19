"""Agente Notícias ("o leitor") — seção 6.1."""

from typing import Any

from app.agents.base import Agent, State
from app.agents.schemas import NewsResult

MAX_HEADLINES = 15


class NewsAgent(Agent[NewsResult]):
    name = "news"
    key = "news"
    schema = NewsResult

    def build_input(self, state: State) -> dict[str, Any] | None:
        items = state.get("news_items") or []
        if not items:
            return None  # sem notícias no período -> sentimento 0, confiança 0
        return {
            "ticker": state["ticker"],
            "now": state["now"],
            "headlines": [
                {k: item[k] for k in ("title", "source", "published", "link")}
                for item in items[:MAX_HEADLINES]
            ],
        }

    def neutral(self, state: State) -> NewsResult:
        return NewsResult(ticker=state["ticker"], sentiment=0, confidence=0)

    def postprocess(
        self, result: NewsResult, state: State, payload: dict[str, Any] | None
    ) -> NewsResult:
        # nunca citar notícia que não veio da ferramenta
        allowed = {h["link"] for h in (payload or {}).get("headlines", [])}
        sources = [s for s in result.sources if s in allowed]
        return result.model_copy(update={"ticker": state["ticker"], "sources": sources})

    def bubble(self, result: NewsResult) -> str:
        if result.confidence == 0:
            return "Nenhuma notícia relevante no período."
        if result.sentiment > 0.1:
            humor = "positivo"
        elif result.sentiment < -0.1:
            humor = "negativo"
        else:
            humor = "neutro"
        return (
            f"Sentimento {humor} ({result.sentiment:+.2f}, confiança {result.confidence:.0%}) "
            f"com {len(result.sources)} fonte(s)."
        )
