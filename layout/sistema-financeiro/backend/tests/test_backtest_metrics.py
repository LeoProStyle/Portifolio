"""Métricas do backtest conferidas contra contas feitas à mão."""

from datetime import datetime, timedelta

import pytest

from app.backtest.metrics import Fill, compute_metrics, max_drawdown, round_trips, verdict
from app.clock import TZ_BRASILIA

T0 = datetime(2025, 1, 2, 10, 0, tzinfo=TZ_BRASILIA)


def _f(day: int, side: str, qty: int, price: float, fee: float, reason: str = "decisao") -> Fill:
    return Fill(T0 + timedelta(days=day), side, qty, price, fee, reason)


TWO_TRADES = [
    _f(0, "COMPRA", 100, 10.0, 1.0),
    _f(5, "VENDA", 100, 12.0, 1.0, "alvo"),  # 1200-1 - (1000+1) = +198
    _f(10, "COMPRA", 50, 20.0, 0.5),
    _f(12, "VENDA", 50, 18.0, 0.5, "stop"),  # 900-0.5 - (1000+0.5) = -101
]


def test_max_drawdown_pico_ao_vale() -> None:
    # pico 120 → vale 90 = queda de 25%; o 130 depois não apaga a queda
    assert max_drawdown([100, 120, 90, 130]) == pytest.approx(0.25)
    assert max_drawdown([100, 110, 120]) == 0.0
    assert max_drawdown([]) == 0.0


def test_round_trips_com_ganho_e_perda() -> None:
    trades = round_trips(TWO_TRADES)
    assert [round(t.pnl, 2) for t in trades] == [198.0, -101.0]
    assert [t.reason for t in trades] == ["alvo", "stop"]
    assert trades[0].fees == pytest.approx(2.0)


def test_round_trip_aberto_nao_conta() -> None:
    assert round_trips([_f(0, "COMPRA", 10, 10.0, 0.1)]) == []


def test_compute_metrics() -> None:
    m = compute_metrics(
        initial_cash=1000.0,
        equity=[1000.0, 1198.0, 1097.0],
        trades=round_trips(TWO_TRADES),
        fees_paid=3.0,
        slippage_paid=2.0,
        asset_return=0.05,
        index_return=None,
    )
    assert m.total_return == pytest.approx(0.097)
    assert m.max_drawdown == pytest.approx(101 / 1198)
    assert m.trades == 2 and m.wins == 1 and m.losses == 1
    assert m.win_rate == pytest.approx(0.5)
    assert m.profit_factor == pytest.approx(198 / 101)
    assert m.costs_paid == pytest.approx(5.0)
    assert m.excess_vs_asset == pytest.approx(0.047)
    assert m.excess_vs_index is None
    assert m.llm_cost == 0.0


def test_metricas_sem_operacoes_sao_neutras() -> None:
    m = compute_metrics(1000.0, [], [], 0.0, 0.0, None, None)
    assert m.total_return == 0.0 and m.trades == 0
    assert m.win_rate is None and m.profit_factor is None


def test_veredito_reprova_com_motivos() -> None:
    m = compute_metrics(1000.0, [1000.0, 900.0], [], 0.0, 0.0, 0.10, 0.02)
    v = verdict(m, period_days=365, max_dd=0.20, min_trades=20)
    assert v.passed is False
    failed = {c.name for c in v.checks if c.ok is False}
    assert {"periodo", "bate_ativo", "bate_indice", "amostra", "fator_lucro"} <= failed


def test_veredito_aprova_e_indice_sem_dados_nao_reprova() -> None:
    fills = [
        f
        for i in range(20)
        for f in (_f(3 * i, "COMPRA", 10, 10.0, 0.0), _f(3 * i + 1, "VENDA", 10, 11.0, 0.0))
    ]
    m = compute_metrics(1000.0, [1000.0, 1200.0], round_trips(fills), 0.0, 0.0, 0.05, None)
    v = verdict(m, period_days=731, max_dd=0.20, min_trades=20)
    assert v.passed is True
    by = {c.name: c.ok for c in v.checks}
    assert by["bate_indice"] is None and by["fator_lucro"] is True


def test_operacao_vendida_de_minicontrato() -> None:
    t0 = datetime(2026, 1, 5, tzinfo=TZ_BRASILIA)
    t1 = datetime(2026, 1, 6, tzinfo=TZ_BRASILIA)
    fills = [
        Fill(t0, "VENDA", 1, 120000.0, 0.5, "decisao"),
        Fill(t1, "COMPRA", 1, 119000.0, 0.5, "alvo"),
    ]
    (trade,) = round_trips(fills, multiplier=0.2)
    # (120000 − 119000) × 1 × 0,20 − custos 1,00
    assert trade.pnl == pytest.approx(199.0) and trade.reason == "alvo"
