"""Contrato dos eventos WebSocket (seção 8 do CLAUDE.md) e o EventBus.

Espelhado em frontend/src/ws/types.ts — manter os dois sincronizados.
"""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from app.clock import TZ_BRASILIA

log = logging.getLogger(__name__)

AgentName = Literal["news", "chart", "bull", "bear", "risk", "manager"]
AgentStatus = Literal["idle", "thinking", "done", "error"]
Action = Literal["COMPRA", "VENDA", "ESPERA"]
Side = Literal["COMPRA", "VENDA"]


def now_brasilia() -> datetime:
    return datetime.now(TZ_BRASILIA)


class _Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------- payloads ----------


class CycleStartedPayload(_Payload):
    ticker: str


class AgentStatusPayload(_Payload):
    agent: AgentName
    status: AgentStatus


class AgentMessagePayload(_Payload):
    agent: AgentName
    text: str = Field(min_length=1)  # texto completo; o balão resume no frontend


class AgentResultPayload(_Payload):
    agent: AgentName
    result: dict[str, Any]


class DecisionPayload(_Payload):
    action: Action
    ticker: str
    qty: int | float = Field(ge=0)  # cripto: fracionária
    stop: float | None = None
    rationale: str


class OrderFilledPayload(_Payload):
    # ticker, reason e time estendem o contrato da seção 8 (necessários para o gráfico)
    ticker: str
    side: Side
    qty: int | float = Field(gt=0)  # cripto: fracionária
    price: float = Field(gt=0)
    fee: float = Field(ge=0)
    reason: Literal["decisao", "stop", "alvo"] = "decisao"
    time: datetime


class Position(_Payload):
    ticker: str
    qty: int | float  # negativa = vendido (minis); fracionária (cripto)
    avg_price: float
    stop: float | None = None
    mark: float | None = None
    pnl: float | None = None


class PortfolioUpdatePayload(_Payload):
    cash: float
    positions: list[Position]
    equity: float
    initial_cash: float | None = None


class Candle(_Payload):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class PriceUpdatePayload(_Payload):
    ticker: str
    candle: Candle


class RiskVetoPayload(_Payload):
    reason: str


class BudgetWarningPayload(_Payload):
    spent: float
    limit: float


class CycleFinishedPayload(_Payload):
    duration_ms: int = Field(ge=0)
    tokens: int = Field(ge=0)
    cost: float = Field(ge=0)


# ---------- envelope ----------


class _EventBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ts: datetime = Field(default_factory=now_brasilia)
    cycle_id: UUID | None = None
    # escritório: sala e robô que geraram o evento (None = ciclo manual antigo)
    room: str | None = None
    robot_id: str | None = None


class CycleStartedEvent(_EventBase):
    type: Literal["cycle_started"]
    payload: CycleStartedPayload


class AgentStatusEvent(_EventBase):
    type: Literal["agent_status"]
    payload: AgentStatusPayload


class AgentMessageEvent(_EventBase):
    type: Literal["agent_message"]
    payload: AgentMessagePayload


class AgentResultEvent(_EventBase):
    type: Literal["agent_result"]
    payload: AgentResultPayload


class DecisionEvent(_EventBase):
    type: Literal["decision"]
    payload: DecisionPayload


class OrderFilledEvent(_EventBase):
    type: Literal["order_filled"]
    payload: OrderFilledPayload


class PortfolioUpdateEvent(_EventBase):
    type: Literal["portfolio_update"]
    payload: PortfolioUpdatePayload


class PriceUpdateEvent(_EventBase):
    type: Literal["price_update"]
    payload: PriceUpdatePayload


class RiskVetoEvent(_EventBase):
    type: Literal["risk_veto"]
    payload: RiskVetoPayload


class BudgetWarningEvent(_EventBase):
    type: Literal["budget_warning"]
    payload: BudgetWarningPayload


class CycleFinishedEvent(_EventBase):
    type: Literal["cycle_finished"]
    payload: CycleFinishedPayload


Event = Annotated[
    CycleStartedEvent
    | AgentStatusEvent
    | AgentMessageEvent
    | AgentResultEvent
    | DecisionEvent
    | OrderFilledEvent
    | PortfolioUpdateEvent
    | PriceUpdateEvent
    | RiskVetoEvent
    | BudgetWarningEvent
    | CycleFinishedEvent,
    Field(discriminator="type"),
]

event_adapter: TypeAdapter[Event] = TypeAdapter(Event)

EVENT_TYPES: tuple[str, ...] = (
    "cycle_started",
    "agent_status",
    "agent_message",
    "agent_result",
    "decision",
    "order_filled",
    "portfolio_update",
    "price_update",
    "risk_veto",
    "budget_warning",
    "cycle_finished",
)


def make_event(
    type_: str,
    cycle_id: UUID | None,
    payload: dict[str, Any],
    *,
    room: str | None = None,
    robot_id: str | None = None,
) -> Event:
    """Cria e valida um evento. Lança ValidationError se não seguir o contrato."""
    return event_adapter.validate_python(
        {
            "type": type_,
            "ts": now_brasilia(),
            "cycle_id": cycle_id,
            "room": room,
            "robot_id": robot_id,
            "payload": payload,
        }
    )


# ---------- EventBus ----------


class EventBus:
    """Pub/sub em memória: cada conexão WS recebe sua própria fila."""

    def __init__(
        self, max_queue: int = 1000, recorder: Callable[[Event], None] | None = None
    ) -> None:
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._max_queue = max_queue
        self._recorder = recorder  # grava cada evento (rastreabilidade no banco)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    async def publish(self, event: Event) -> None:
        if self._recorder is not None:
            # ARCH-001: falha ao gravar no banco não pode impedir que o evento
            # chegue à tela (senão o ciclo fica "travado" sem cycle_finished)
            try:
                self._recorder(event)
            except Exception:
                log.exception("Falha ao gravar evento %s no log", event.type)
        for queue in list(self._subscribers):
            if queue.full():
                # cliente lento: descarta o evento mais antigo em vez de travar o ciclo
                queue.get_nowait()
            queue.put_nowait(event)

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[Event]]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._max_queue)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)
