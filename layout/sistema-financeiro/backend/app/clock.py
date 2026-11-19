"""Relógio do sistema: real (ao vivo) ou simulado (replay/backtest, Fase 6).

Todo dado entregue a um agente é filtrado por `clock.now()` (regra nº 5).
"""

from datetime import datetime, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

TZ_BRASILIA = ZoneInfo("America/Sao_Paulo")


class Clock(Protocol):
    def now(self) -> datetime: ...


class RealClock:
    def now(self) -> datetime:
        return datetime.now(TZ_BRASILIA)


class SimulatedClock:
    """Relógio controlado manualmente (replay e testes)."""

    def __init__(self, start: datetime) -> None:
        if start.tzinfo is None:
            raise ValueError("SimulatedClock exige datetime com fuso horário")
        self._now = start.astimezone(TZ_BRASILIA)

    def now(self) -> datetime:
        return self._now

    def set(self, moment: datetime) -> None:
        if moment.tzinfo is None:
            raise ValueError("datetime precisa ter fuso horário")
        self._now = moment.astimezone(TZ_BRASILIA)

    def advance(self, delta: timedelta) -> None:
        self._now += delta
