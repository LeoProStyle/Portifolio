"""Ordenação dos candidatos de um robô rastreador (função pura, indicadores em código).

Só ativos que JÁ deram sinal de entrada chegam aqui; a ordem decide quem ocupa as
vagas: reversão por IFR → o mais sobrevendido primeiro; demais estratégias
(tendência/rompimento) → a maior alta dos últimos 20 candles primeiro.
"""

import math

import pandas as pd

from app.indicators.technical import rsi

MOMENTUM_WINDOW = 20


def score(kind: str, candles: pd.DataFrame) -> float:
    """Quanto maior, mais forte o sinal. Dados insuficientes → −∞ (fim da fila)."""
    close = candles["close"]
    if kind == "rsi_reversion":
        if len(close) < 16:
            return -math.inf
        value = float(rsi(close, 14).iloc[-1])
        return -value if not math.isnan(value) else -math.inf
    if len(close) <= MOMENTUM_WINDOW or float(close.iloc[-MOMENTUM_WINDOW - 1]) <= 0:
        return -math.inf
    return float(close.iloc[-1]) / float(close.iloc[-MOMENTUM_WINDOW - 1]) - 1


def rank_candidates(kind: str, candidates: dict[str, pd.DataFrame]) -> list[str]:
    """Chaves dos candidatos do sinal mais forte ao mais fraco (empate: ordem alfabética)."""
    return sorted(candidates, key=lambda k: (-score(kind, candidates[k]), k))
