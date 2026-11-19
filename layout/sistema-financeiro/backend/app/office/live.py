"""Avaliação ao vivo de um robô (simulação com dados reais), funções puras.

Critério de candidato (spec §8): pelo menos 3 meses ao vivo com a MESMA
configuração e bater o "comprar e segurar" depois dos custos. Aqui só se mede;
passar não libera conta real.
"""

from datetime import datetime
from typing import Any

from app.clock import TZ_BRASILIA

LIVE_TARGET_DAYS = 90  # ≈ 3 meses


def live_days(started_ts: int, now: datetime) -> int:
    """Dias corridos desde o início da conta ao vivo (mudar a configuração zera)."""
    return max(0, int((now.timestamp() - started_ts) // 86_400))


def hold_return(closes: list[float], multiplier: float | None, initial: float) -> float | None:
    """Comprar e segurar desde o início da conta.

    Ação/cripto: último ÷ primeiro − 1. Minicontrato: 1 contrato,
    (último − primeiro) × multiplicador ÷ capital inicial. Menos de 2 preços → None.
    """
    if len(closes) < 2 or closes[0] <= 0 or initial <= 0:
        return None
    if multiplier is not None:
        return (closes[-1] - closes[0]) * multiplier / initial
    return closes[-1] / closes[0] - 1


def live_summary(
    started_ts: int, now: datetime, robot_return: float, hold: float | None
) -> dict[str, Any]:
    days = live_days(started_ts, now)
    return {
        "since": datetime.fromtimestamp(started_ts, TZ_BRASILIA).isoformat(),
        "days": days,
        "target_days": LIVE_TARGET_DAYS,
        "remaining_days": max(0, LIVE_TARGET_DAYS - days),
        "robot_return": robot_return,
        "hold_return": hold,
        "beats_hold": None if hold is None else robot_return > hold,
    }
