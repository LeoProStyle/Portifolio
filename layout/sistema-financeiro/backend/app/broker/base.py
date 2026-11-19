"""Interface de corretora.

REGRA INVIOLÁVEL Nº 1: somente paper trading. Não existe implementação de
corretora real neste projeto, e `create_broker` só devolve o PaperBroker.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Literal

import pandas as pd
from sqlalchemy import Engine

if TYPE_CHECKING:
    from app.config import Settings

Side = Literal["COMPRA", "VENDA"]
OrderStatus = Literal["pending", "filled", "rejected"]


@dataclass(frozen=True)
class Order:
    id: str
    cycle_id: str | None
    ticker: str
    side: Side
    qty: int
    stop: float | None
    reason: str
    status: OrderStatus
    created_at: datetime
    filled_at: datetime | None = None
    filled_qty: int | None = None
    fill_price: float | None = None
    fee: float | None = None
    note: str = ""


@dataclass(frozen=True)
class Fill:
    order_id: str
    ticker: str
    side: Side
    qty: int
    price: float
    fee: float
    ts: pd.Timestamp
    reason: str


@dataclass(frozen=True)
class PositionView:
    ticker: str
    qty: int
    avg_price: float
    stop: float | None
    mark: float
    value: float
    pnl: float


@dataclass(frozen=True)
class PortfolioSnapshot:
    cash: float
    equity: float
    initial_cash: float
    positions: list[PositionView] = field(default_factory=list)


class Broker(ABC):
    @abstractmethod
    def submit_order(
        self,
        ticker: str,
        side: Side,
        qty: int,
        stop: float | None,
        at: datetime,
        cycle_id: str | None = None,
        target: float | None = None,
    ) -> Order: ...

    @abstractmethod
    def process_candles(self, ticker: str, candles: pd.DataFrame) -> list[Fill]: ...

    @abstractmethod
    def portfolio(self, marks: dict[str, float]) -> PortfolioSnapshot: ...

    @abstractmethod
    def position_qty(self, ticker: str) -> int: ...

    @abstractmethod
    def active_tickers(self) -> set[str]: ...

    @abstractmethod
    def record_equity(self, at: datetime, marks: dict[str, float]) -> None: ...

    @abstractmethod
    def daily_pnl_pct(self, at: datetime, marks: dict[str, float]) -> float: ...

    @abstractmethod
    def list_orders(
        self, ticker: str | None = None, status: OrderStatus | None = None, limit: int = 100
    ) -> list[Order]: ...


def create_broker(
    settings: "Settings",
    engine: Engine,
    account_id: str = "default",
    initial_cash: float | None = None,
) -> Broker:
    """Única fábrica de corretora do sistema: sempre simulada (uma conta por execução)."""
    from app.broker.paper import PaperBroker

    if settings.live_trading_enabled:  # Settings já recusa isso; checagem dupla de propósito
        raise RuntimeError("Operação real não é suportada: somente paper trading.")
    return PaperBroker(
        engine,
        initial_cash=float(settings.initial_cash if initial_cash is None else initial_cash),
        fee_pct=float(settings.fee_pct),
        slippage_pct=float(settings.slippage_pct),
        account_id=account_id,
    )
