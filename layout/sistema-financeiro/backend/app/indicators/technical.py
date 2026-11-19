"""Indicadores técnicos calculados em código (regra inviolável nº 4).

O LLM nunca calcula nada disso; ele só recebe o resumo de `summarize`.
Convenções:
- EMA semeada com a SMA dos primeiros `n` valores (padrão TA-Lib).
- RSI e ATR usam a suavização de Wilder.
- Volatilidade = desvio-padrão amostral dos retornos log × √252 (anualizada).
"""

import math
from typing import Any

import numpy as np
import pandas as pd

TRADING_DAYS = 252


def sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n, min_periods=n).mean()


def ema(series: pd.Series, n: int) -> pd.Series:
    values = series.to_numpy(dtype=float)
    out = np.full(len(values), np.nan)
    if len(values) >= n:
        alpha = 2 / (n + 1)
        out[n - 1] = values[:n].mean()
        for i in range(n, len(values)):
            out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
    return pd.Series(out, index=series.index)


def _wilder(values: np.ndarray, n: int, first: int) -> np.ndarray:
    """Média de Wilder: semente = média simples de values[first:first+n]."""
    out = np.full(len(values), np.nan)
    seed_end = first + n
    if len(values) >= seed_end:
        out[seed_end - 1] = values[first:seed_end].mean()
        for i in range(seed_end, len(values)):
            out[i] = (out[i - 1] * (n - 1) + values[i]) / n
    return out


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff().to_numpy(dtype=float)
    gains = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)
    # delta[0] é NaN: as médias começam no índice 1
    avg_gain = _wilder(gains, n, first=1)
    avg_loss = _wilder(losses, n, first=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        out = 100 - 100 / (1 + avg_gain / avg_loss)
    out = np.where((avg_loss == 0) & ~np.isnan(avg_gain), 100.0, out)
    return pd.Series(out, index=close.index)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    valid = line.dropna()
    sig = pd.Series(np.nan, index=close.index)
    if len(valid) >= signal:
        sig.loc[valid.index] = ema(valid, signal)
    return pd.DataFrame({"macd": line, "signal": sig, "hist": line - sig})


def atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(
        axis=1
    )
    return pd.Series(_wilder(tr.to_numpy(dtype=float), n, first=0), index=close.index)


def volatility(close: pd.Series, n: int = 20) -> pd.Series:
    log_ret = np.log(close / close.shift(1))
    return log_ret.rolling(n, min_periods=n).std(ddof=1) * math.sqrt(TRADING_DAYS)


def _last(series: pd.Series) -> float | None:
    if series.empty:
        return None
    value = series.iloc[-1]
    return None if pd.isna(value) else round(float(value), 4)


def summarize(candles: pd.DataFrame) -> dict[str, Any]:
    """Resumo compacto para o Agente Gráfico (nunca o histórico bruto).

    `candles`: DataFrame indexado por tempo com open/high/low/close/volume,
    já filtrado para timestamps ≤ instante simulado.
    """
    if candles.empty:
        return {"last_candle": None}

    close, high, low = candles["close"], candles["high"], candles["low"]
    last = candles.iloc[-1]
    m = macd(close)
    return {
        "last_candle": {
            "time": candles.index[-1].isoformat(),
            "open": round(float(last["open"]), 4),
            "high": round(float(last["high"]), 4),
            "low": round(float(last["low"]), 4),
            "close": round(float(last["close"]), 4),
            "volume": float(last["volume"]),
        },
        "sma20": _last(sma(close, 20)),
        "sma50": _last(sma(close, 50)),
        "ema9": _last(ema(close, 9)),
        "rsi14": _last(rsi(close, 14)),
        "macd": {k: _last(m[k]) for k in ("macd", "signal", "hist")},
        "atr14": _last(atr(high, low, close, 14)),
        "vol20": _last(volatility(close, 20)),
        "candles_used": len(candles),
    }
