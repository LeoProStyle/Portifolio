"""Câmbio para consolidar o prédio em reais (sem look-ahead, regra 5).

Salas em dólar (cripto) são convertidas pelo último fechamento COMPLETO de
USDBRL=X no instante pedido. Sem cotação → `None`: o prédio avisa e não inventa.
"""

from datetime import datetime

from app.data.prices import PriceStore

FX_TICKER = "USDBRL=X"


def usd_brl(prices: PriceStore, at: datetime) -> float | None:
    df = prices.get_candles(FX_TICKER, until=at, lookback_days=10)
    return None if df.empty else float(df["close"].iloc[-1])


def rate_for(prices: PriceStore, currency: str, at: datetime) -> float | None:
    """Reais por unidade da moeda da sala (BRL = 1)."""
    if currency == "BRL":
        return 1.0
    if currency == "USD":
        return usd_brl(prices, at)
    return None
