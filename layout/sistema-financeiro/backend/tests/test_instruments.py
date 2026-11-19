"""Alimentador de instrumentos: candles do proxy convertidos em pontos."""

from datetime import datetime

import pytest

from app.clock import TZ_BRASILIA
from app.data.instruments import InstrumentFeed
from app.data.prices import PriceStore
from app.db.models import make_engine
from app.office.config import InstrumentConfig
from tests.fakes import FakePrices

WDO = InstrumentConfig(
    symbol="WDO",
    name="Mini-dólar",
    source="USDBRL=X",
    scale=1000,
    multiplier=10,
    fee_per_contract=1.2,
    margin_per_contract=9000,
    slippage_points=0.5,
)


def test_escala_do_proxy_e_volume_intacto() -> None:
    prices = PriceStore(make_engine("sqlite://"), FakePrices("alta"))
    at = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)
    raw = prices.get_candles("USDBRL=X", until=at, lookback_days=30)
    feed = InstrumentFeed(prices)
    pts = feed.get_candles(WDO, until=at, lookback_days=30)
    assert len(pts) == len(raw) and len(pts) > 0
    for col in ("open", "high", "low", "close"):
        assert pts[col].iloc[-1] == pytest.approx(raw[col].iloc[-1] * 1000)
    assert pts["volume"].iloc[-1] == raw["volume"].iloc[-1]
