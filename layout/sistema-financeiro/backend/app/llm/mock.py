"""MockProvider: respostas determinísticas e sem custo (dev e testes).

Ele "finge" ser o LLM com regras simples sobre a mesma entrada JSON que o
LLM real receberia. Serve para o ciclo completo rodar de ponta a ponta; não
é uma estratégia de investimento.
"""

import json
from collections.abc import Callable
from typing import Any

from app.data.news import fold
from app.llm.provider import LLMResponse

POSITIVE = [
    "lucro",
    "recorde",
    "alta",
    "sobe",
    "dispara",
    "aprova",
    "dividendo",
    "eleva",
    "supera",
    "cresce",
    "avanca",
    "compra",
]
NEGATIVE = [
    "queda",
    "cai",
    "prejuizo",
    "corte",
    "corta",
    "reduz",
    "rebaixa",
    "nula",
    "multa",
    "investiga",
    "recua",
    "despenca",
    "perde",
    "venda",
]

Handler = Callable[[dict[str, Any]], dict[str, Any]]


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _news(data: dict[str, Any]) -> dict[str, Any]:
    headlines = data.get("headlines", [])
    pos = neg = 0
    for h in headlines:
        title = fold(h.get("title", ""))
        pos += any(w in title for w in POSITIVE)
        neg += any(w in title for w in NEGATIVE)
    sentiment = 0.6 * (pos - neg) / max(1, pos + neg)
    top = headlines[:3]
    return {
        "ticker": data["ticker"],
        "sentiment": round(_clamp(sentiment), 2),
        "confidence": round(min(0.7, 0.1 + 0.05 * len(headlines)), 2),
        "key_points": [h["title"][:160] for h in top],
        "sources": [h["link"] for h in top],
    }


def _chart(data: dict[str, Any]) -> dict[str, Any]:
    ind = data["indicators"]
    close = ind["last_candle"]["close"]
    sma20, sma50, rsi = ind.get("sma20"), ind.get("sma50"), ind.get("rsi14")
    if sma20 and sma50 and close > sma20 > sma50:
        trend, signal = "alta", 0.5
    elif sma20 and sma50 and close < sma20 < sma50:
        trend, signal = "baixa", -0.5
    else:
        trend, signal = "lateral", 0.0
    if rsi is not None and rsi > 70:
        signal -= 0.15
    elif rsi is not None and rsi < 30:
        signal += 0.15
    return {
        "ticker": data["ticker"],
        "trend": trend,
        "signal": round(_clamp(signal), 2),
        "confidence": 0.5 if sma50 else 0.2,
        "reasoning": (
            f"[mock] Fechamento {close:.2f}, MM20 {sma20}, MM50 {sma50}, IFR14 {rsi}: "
            f"tendência {trend}."
        ),
    }


def _manager_proposal(data: dict[str, Any]) -> dict[str, Any]:
    news, chart = data["news"], data["chart"]
    score = 0.6 * chart["signal"] + 0.4 * news["sentiment"] * news["confidence"]
    held = data.get("position_qty", 0)
    if held == 0 and score >= 0.2:
        action = "COMPRA"
    elif held > 0 and score <= -0.2:
        action = "VENDA"
    else:
        action = "ESPERA"
    return {
        "action": action,
        "rationale": (
            f"[mock] Pontuação {score:+.2f} (0,6×gráfico {chart['signal']:+.2f} + "
            f"0,4×notícias {news['sentiment']:+.2f}×{news['confidence']:.2f}); posição {held}."
        ),
    }


def _risk(data: dict[str, Any]) -> dict[str, Any]:
    rules = data["rules"]
    return {
        "approved": rules["approved"],
        "max_qty": rules["max_qty"],
        "stop": rules["stop"],
        "notes": "[mock] Segue os limites calculados em código.",
    }


def _manager_final(data: dict[str, Any]) -> dict[str, Any]:
    risk, proposal = data["risk"], data["proposal"]
    approved = risk["approved"] and proposal["action"] != "ESPERA"
    return {
        "action": proposal["action"] if approved else "ESPERA",
        "ticker": data["ticker"],
        "qty": risk["max_qty"] if approved else 0,
        "stop": risk["stop"],
        # a proposta já vem marcada com [mock]
        "rationale": f"{proposal['rationale']} Risco: {risk['notes']}"[:600],
    }


HANDLERS: dict[str, Handler] = {
    "news": _news,
    "chart": _chart,
    "manager_proposal": _manager_proposal,
    "risk": _risk,
    "manager_final": _manager_final,
}


class MockProvider:
    name = "mock"

    async def complete(self, *, agent: str, system: str, user: str) -> LLMResponse:
        result = HANDLERS[agent](json.loads(user))
        text = json.dumps(result, ensure_ascii=False)
        # estimativa grosseira (~4 caracteres por token); custo do mock é zero
        return LLMResponse(
            text=text, input_tokens=(len(system) + len(user)) // 4, output_tokens=len(text) // 4
        )
