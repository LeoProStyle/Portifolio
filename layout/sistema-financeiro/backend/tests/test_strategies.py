"""Estratégias puras e plano de saída (stop/alvo)."""

import numpy as np
import pandas as pd
import pytest

from app.office.config import StrategySpec
from app.strategies import build_strategy
from app.strategies.exits import plan_exit


def _df(closes: list[float], highs=None, lows=None) -> pd.DataFrame:
    closes = [float(c) for c in closes]
    idx = pd.date_range("2026-01-01", periods=len(closes), freq="D", tz="America/Sao_Paulo")
    highs = highs if highs is not None else [c + 0.5 for c in closes]
    lows = lows if lows is not None else [c - 0.5 for c in closes]
    return pd.DataFrame(
        {"open": closes, "high": highs, "low": lows, "close": closes, "volume": 2e6}, index=idx
    )


def _s(kind: str, **params: float):
    return build_strategy(StrategySpec(kind=kind, params=params))


DOWN = list(np.linspace(20, 15, 40))
UP = list(np.linspace(15, 20, 40))


@pytest.mark.parametrize(
    ("kind", "closes", "pos", "action"),
    [
        ("sma_cross", DOWN + [40], 0, "COMPRA"),
        ("sma_cross", UP + [5], 10, "VENDA"),
        ("rsi_reversion", DOWN, 0, "COMPRA"),
        ("rsi_reversion", UP, 10, "VENDA"),
        ("ma20_reclaim", [10] * 25 + [9, 11], 0, "COMPRA"),
        ("ma20_reclaim", [10] * 25 + [11, 9], 10, "VENDA"),
        ("oversold_bounce", DOWN + [15.5], 0, "COMPRA"),
        ("oversold_bounce", UP, 10, "VENDA"),
        ("atr_trend", list(np.linspace(10, 30, 60)), 0, "COMPRA"),
        ("atr_trend", list(np.linspace(10, 30, 60)) + [20], 10, "VENDA"),
    ],
)
def test_sinais_basicos(kind: str, closes: list[float], pos: int, action: str) -> None:
    sig = _s(kind).decide(_df(closes), pos)
    assert sig.action == action, sig.reason


def test_donchian_rompimento_e_saida() -> None:
    flat = [10.0] * 25
    compra = _s("donchian").decide(_df(flat + [12], [10.5] * 25 + [12.5], [9.5] * 25 + [11.5]), 0)
    venda = _s("donchian").decide(_df(flat + [9], [10.5] * 25 + [9.5], [9.5] * 25 + [8.5]), 10)
    assert compra.action == "COMPRA" and venda.action == "VENDA"


def test_bull_flag_compra_no_rompimento_da_bandeira() -> None:
    pole = list(np.linspace(10, 12, 11))  # +20% em 10 pregões
    flag = [12.0, 11.9, 12.05, 11.95, 12.0]  # faixa < 5%
    sig = _s("bull_flag").decide(_df(pole + flag + [12.8]), 0)
    assert sig.action == "COMPRA", sig.reason


def test_bull_flag_sem_mastro_espera() -> None:
    sig = _s("bull_flag").decide(_df([12.0] * 16 + [12.8]), 0)
    assert sig.action == "ESPERA"


def test_bull_flag_vende_abaixo_da_mm10() -> None:
    sig = _s("bull_flag").decide(_df([12.0] * 20 + [10.0]), 10)
    assert sig.action == "VENDA"


@pytest.mark.parametrize(
    "kind",
    [
        "sma_cross",
        "rsi_reversion",
        "donchian",
        "atr_trend",
        "bull_flag",
        "ma20_reclaim",
        "oversold_bounce",
    ],
)
def test_poucos_candles_espera(kind: str) -> None:
    sig = _s(kind).decide(_df([10, 11, 12, 11, 10]), 0)
    assert sig.action == "ESPERA"
    assert "candles insuficientes" in sig.reason


def test_sem_posicao_nao_vende_e_com_posicao_nao_compra_de_novo() -> None:
    assert _s("rsi_reversion").decide(_df(UP), 0).action == "ESPERA"
    assert _s("rsi_reversion").decide(_df(DOWN), 10).action == "ESPERA"


def test_build_strategy_mesa_ia_e_desconhecida() -> None:
    with pytest.raises(ValueError):
        build_strategy(StrategySpec(kind="mesa_ia"))


# ---------- plano de saída (adaptado do Trader skill v2, MIT) ----------


def test_plan_exit_alvo_2r() -> None:
    plan = plan_exit(entry=50.0, atr=1.0)  # stop = 50 - 2×1 = 48 ; risco 2 ; alvo = 54
    assert plan.stop == 48.0 and plan.target == 54.0


def test_plan_exit_recusa_stop_acima_da_entrada() -> None:
    with pytest.raises(ValueError):
        plan_exit(entry=50.0, atr=-1.0)


def test_plan_exit_recusa_risco_minusculo() -> None:
    with pytest.raises(ValueError):
        plan_exit(entry=50.0, atr=0.00001)
