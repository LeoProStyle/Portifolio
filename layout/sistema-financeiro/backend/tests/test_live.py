"""Avaliação ao vivo: dias de simulação e comprar e segurar desde o início da conta."""

from datetime import datetime

import pytest

from app.clock import TZ_BRASILIA
from app.office.live import LIVE_TARGET_DAYS, hold_return, live_days, live_summary


def test_dias_ao_vivo() -> None:
    start = int(datetime(2026, 11, 18, 18, 5, tzinfo=TZ_BRASILIA).timestamp())
    assert live_days(start, datetime(2026, 11, 18, 23, 0, tzinfo=TZ_BRASILIA)) == 0
    assert live_days(start, datetime(2026, 11, 28, 18, 5, tzinfo=TZ_BRASILIA)) == 10
    assert LIVE_TARGET_DAYS == 90


def test_comprar_e_segurar_acao_e_contrato() -> None:
    assert hold_return([50.0, 55.0], None, 100_000) == pytest.approx(0.10)
    # 1 contrato de WIN: (171000 − 170000) × 0,20 ÷ 100 mil = 0,2%
    assert hold_return([170_000.0, 171_000.0], 0.2, 100_000) == pytest.approx(0.002)
    assert hold_return([50.0], None, 100_000) is None  # conta nova: sem dado, nada inventado
    assert hold_return([], 0.2, 100_000) is None


def test_resumo_compara_robo_com_comprar_e_segurar() -> None:
    start = int(datetime(2026, 11, 1, tzinfo=TZ_BRASILIA).timestamp())
    now = datetime(2026, 11, 19, tzinfo=TZ_BRASILIA)
    s = live_summary(start, now, robot_return=0.03, hold=0.05)
    assert s == {
        "since": "2026-11-01T00:00:00-03:00",
        "days": 18,
        "target_days": 90,
        "remaining_days": 72,
        "robot_return": 0.03,
        "hold_return": 0.05,
        "beats_hold": False,
    }
    assert live_summary(start, now, robot_return=0.0, hold=None)["beats_hold"] is None
