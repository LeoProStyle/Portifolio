"""Plano de saída: stop e alvo definidos ANTES da entrada.

Regras adaptadas do "Trader skill v2" (Jake Schincariol, licença MIT,
github.com/Jakeschincariol/day-trader-skill):
- alvo = entrada + R × risco (2R por padrão);
- recusa stop >= entrada, alvo <= entrada e risco menor que 0,05% do preço;
- o stop nunca é afastado depois da entrada.
"""

from dataclasses import dataclass
from typing import Literal

MIN_RISK_PCT = 0.0005


@dataclass(frozen=True)
class ExitPlan:
    stop: float
    target: float


def plan_exit(
    entry: float,
    atr: float,
    atr_mult: float = 2.0,
    r_multiple: float = 2.0,
    side: Literal["COMPRA", "VENDA"] = "COMPRA",
) -> ExitPlan:
    """Comprado: stop abaixo e alvo acima. Vendido (minicontratos): o espelho."""
    sign = 1 if side == "COMPRA" else -1
    stop = round(entry - sign * atr_mult * atr, 2)
    risk = (entry - stop) * sign
    if risk <= 0:
        raise ValueError(f"stop {stop} do lado errado da entrada {entry}")
    if risk < entry * MIN_RISK_PCT:
        raise ValueError(f"risco {risk:.4f} menor que {MIN_RISK_PCT:.2%} do preço")
    target = round(entry + sign * r_multiple * risk, 2)
    if (target - entry) * sign <= 0:
        raise ValueError(f"alvo {target} do lado errado da entrada {entry}")
    return ExitPlan(stop=stop, target=target)
