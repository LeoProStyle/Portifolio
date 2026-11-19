"""Indicadores conferidos contra cálculo manual em séries pequenas (seção 15).

As contas de cada valor esperado estão nos comentários.
"""

import math

import numpy as np
import pandas as pd
import pytest

from app.indicators.technical import atr, ema, macd, rsi, sma, summarize, volatility


def _s(values: list[float]) -> pd.Series:
    return pd.Series(values, dtype=float)


def _assert_series(result: pd.Series, expected: list[float | None]) -> None:
    assert len(result) == len(expected)
    for got, exp in zip(result.tolist(), expected, strict=True):
        if exp is None:
            assert math.isnan(got)
        else:
            assert got == pytest.approx(exp)


def test_sma_3() -> None:
    # (1+2+3)/3=2, (2+3+4)/3=3, (3+4+5)/3=4
    _assert_series(sma(_s([1, 2, 3, 4, 5]), 3), [None, None, 2, 3, 4])


def test_ema_3_semeada_com_sma() -> None:
    # alpha = 2/(3+1) = 0.5; semente = SMA(2,4,6) = 4
    # 0.5*8 + 0.5*4 = 6 ; 0.5*4 + 0.5*6 = 5
    _assert_series(ema(_s([2, 4, 6, 8, 4]), 3), [None, None, 4, 6, 5])


def test_rsi_3_wilder() -> None:
    # variações: +1 +1 -1 +2 -1
    # 1ª média (3 primeiras): ganho 2/3, perda 1/3 -> RS 2 -> RSI 66.667
    # +2: ganho (2/3*2+2)/3 = 10/9, perda (1/3*2)/3 = 2/9 -> RS 5 -> 83.333
    # -1: ganho (10/9*2)/3 = 20/27, perda (2/9*2+1)/3 = 13/27 -> RS 20/13 -> 60.606
    _assert_series(
        rsi(_s([10, 11, 12, 11, 13, 12]), 3),
        [None, None, None, 200 / 3, 250 / 3, 100 - 100 / (1 + 20 / 13)],
    )


def test_rsi_sem_perdas_e_100() -> None:
    assert rsi(_s([1, 2, 3, 4, 5]), 3).iloc[-1] == pytest.approx(100)


def test_atr_3_wilder() -> None:
    high = _s([10, 11, 12, 11, 13])
    low = _s([8, 9, 10, 8, 10])
    close = _s([9, 10, 11, 9, 12])
    # TR: 2 ; max(2,|11-9|,|9-9|)=2 ; max(2,2,0)=2 ; max(3,0,|8-11|)=3 ; max(3,|13-9|,1)=4
    # ATR[2] = (2+2+2)/3 = 2 ; ATR[3] = (2*2+3)/3 = 7/3 ; ATR[4] = (7/3*2+4)/3 = 26/9
    _assert_series(atr(high, low, close, 3), [None, None, 2, 7 / 3, 26 / 9])


def test_volatilidade_anualizada() -> None:
    closes = _s([100, 110, 99, 108.9])
    rets = [math.log(110 / 100), math.log(99 / 110), math.log(108.9 / 99)]
    media = sum(rets) / 3
    desvio = math.sqrt(sum((r - media) ** 2 for r in rets) / 2)  # ddof=1
    assert volatility(closes, 3).iloc[-1] == pytest.approx(desvio * math.sqrt(252))


def test_macd_em_serie_constante_e_zero() -> None:
    result = macd(_s([50.0] * 60))
    last = result.iloc[-1]
    assert last["macd"] == pytest.approx(0)
    assert last["signal"] == pytest.approx(0)
    assert last["hist"] == pytest.approx(0)


def test_macd_e_diferenca_das_emas() -> None:
    closes = _s(list(np.linspace(10, 30, 60)))
    result = macd(closes)
    esperado = ema(closes, 12) - ema(closes, 26)
    assert result["macd"].iloc[-1] == pytest.approx(esperado.iloc[-1])
    assert result["hist"].iloc[-1] == pytest.approx(
        result["macd"].iloc[-1] - result["signal"].iloc[-1]
    )


def _candles(n: int) -> pd.DataFrame:
    closes = np.linspace(20, 30, n)
    idx = pd.date_range("2026-01-01", periods=n, freq="D", tz="America/Sao_Paulo")
    return pd.DataFrame(
        {"open": closes, "high": closes + 1, "low": closes - 1, "close": closes, "volume": 1000.0},
        index=idx,
    )


def test_summarize_com_historico_suficiente() -> None:
    resumo = summarize(_candles(80))
    assert resumo["last_candle"]["close"] == pytest.approx(30)
    for chave in ("sma20", "sma50", "ema9", "rsi14", "atr14", "vol20"):
        assert resumo[chave] is not None
    assert resumo["rsi14"] == pytest.approx(100)  # série só sobe
    assert set(resumo["macd"]) == {"macd", "signal", "hist"}


def test_summarize_com_pouco_historico_retorna_none() -> None:
    resumo = summarize(_candles(10))
    assert resumo["sma20"] is None
    assert resumo["sma50"] is None
    assert resumo["ema9"] is not None


def test_summarize_vazio() -> None:
    assert summarize(_candles(0)) == {"last_candle": None}
