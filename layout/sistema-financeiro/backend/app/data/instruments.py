"""Candles de instrumentos simulados por PROXY (minicontratos).

WIN ≈ ^BVSP em pontos; WDO ≈ USDBRL=X × 1000. A série é a do proxy, já filtrada
pelo PriceStore (só candles completos no instante pedido), multiplicada pela escala.
Limitação declarada: sem base (futuro × à vista) e sem rolagem de vencimento.
"""

from datetime import datetime

import pandas as pd

from app.data.prices import Interval, PriceStore
from app.office.config import InstrumentConfig

PRICE_COLUMNS = ["open", "high", "low", "close"]


class InstrumentFeed:
    def __init__(self, prices: PriceStore) -> None:
        self._prices = prices

    def get_candles(
        self,
        inst: InstrumentConfig,
        until: datetime,
        lookback_days: int = 365,
        interval: Interval = "1d",
        refresh: bool = True,
    ) -> pd.DataFrame:
        df = self._prices.get_candles(
            inst.source,
            until=until,
            lookback_days=lookback_days,
            interval=interval,
            refresh=refresh,
        )
        if df.empty or inst.scale == 1:
            return df
        out = df.copy()
        out[PRICE_COLUMNS] = out[PRICE_COLUMNS] * inst.scale
        return out
