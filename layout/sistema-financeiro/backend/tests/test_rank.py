"""Ordenação dos candidatos do rastreador (quem tem o sinal mais forte vem primeiro)."""

import numpy as np
import pandas as pd

from app.strategies.rank import rank_candidates, score


def _serie(closes: list[float]) -> pd.DataFrame:
    c = np.array(closes, dtype=float)
    return pd.DataFrame({"open": c, "high": c + 0.5, "low": c - 0.5, "close": c, "volume": 1e6})


def test_reversao_por_ifr_prefere_o_mais_sobrevendido() -> None:
    queda_forte = _serie([100 - i * 2 for i in range(30)])  # IFR muito baixo
    queda_leve = _serie([100 - i * 0.5 + (i % 2) * 0.8 for i in range(30)])
    assert rank_candidates("rsi_reversion", {"A": queda_leve, "B": queda_forte}) == ["B", "A"]


def test_demais_estrategias_preferem_a_maior_alta_de_20_candles() -> None:
    sobe_muito = _serie([50 + i * 2 for i in range(30)])
    sobe_pouco = _serie([50 + i * 0.2 for i in range(30)])
    assert rank_candidates("donchian", {"X": sobe_pouco, "Y": sobe_muito}) == ["Y", "X"]


def test_poucos_candles_vao_para_o_fim() -> None:
    curta = _serie([10.0, 11.0])
    longa = _serie([50 + i for i in range(30)])
    assert rank_candidates("donchian", {"C": curta, "L": longa}) == ["L", "C"]
    assert score("donchian", curta) == float("-inf")
