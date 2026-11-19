"""Agente Gráfico ("o analista técnico") — seção 6.2."""

from typing import Any

from app.agents.base import Agent, State
from app.agents.schemas import ChartResult


class ChartAgent(Agent[ChartResult]):
    name = "chart"
    key = "chart"
    schema = ChartResult

    def build_input(self, state: State) -> dict[str, Any] | None:
        indicators = state.get("indicators") or {}
        if not indicators.get("last_candle"):
            return None
        # só o resumo calculado em código, nunca o histórico bruto
        return {"ticker": state["ticker"], "now": state["now"], "indicators": indicators}

    def neutral(self, state: State) -> ChartResult:
        return ChartResult(
            ticker=state["ticker"],
            trend="lateral",
            signal=0,
            confidence=0,
            reasoning="Sem candles suficientes para avaliar.",
        )

    def postprocess(
        self, result: ChartResult, state: State, payload: dict[str, Any] | None
    ) -> ChartResult:
        return result.model_copy(update={"ticker": state["ticker"]})

    def bubble(self, result: ChartResult) -> str:
        return f"Tendência de {result.trend}, sinal {result.signal:+.2f}. {result.reasoning}"
