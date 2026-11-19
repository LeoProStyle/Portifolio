"""Estratégias dos robôs (código determinístico, sem custo de LLM)."""

from app.office.config import StrategySpec
from app.strategies.base import Signal, Strategy
from app.strategies.rules import (
    AtrTrend,
    BullFlag,
    Donchian,
    Ma20Reclaim,
    OversoldBounce,
    RsiReversion,
    SmaCross,
)

_REGISTRY: dict[str, type] = {
    "sma_cross": SmaCross,
    "rsi_reversion": RsiReversion,
    "donchian": Donchian,
    "atr_trend": AtrTrend,
    "bull_flag": BullFlag,
    "ma20_reclaim": Ma20Reclaim,
    "oversold_bounce": OversoldBounce,
}


def build_strategy(spec: StrategySpec) -> Strategy:
    cls = _REGISTRY.get(spec.kind)
    if cls is None:  # mesa_ia é tratada pelo motor (equipe de agentes)
        raise ValueError(f"Estratégia sem implementação em código: {spec.kind}")
    return cls(**spec.params)  # type: ignore[no-any-return]


__all__ = ["Signal", "Strategy", "build_strategy"]
