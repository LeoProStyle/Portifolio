"""Interface das estratégias: uma função pura de candles → sinal."""

from dataclasses import dataclass
from typing import Literal, Protocol

import pandas as pd

Action = Literal["COMPRA", "VENDA", "ESPERA"]


@dataclass(frozen=True)
class Signal:
    action: Action
    reason: str


class Strategy(Protocol):
    def decide(self, candles: pd.DataFrame, position_qty: int) -> Signal: ...


def hold(reason: str) -> Signal:
    return Signal("ESPERA", reason)


def not_enough(have: int, need: int) -> Signal:
    return hold(f"candles insuficientes ({have} de {need})")
