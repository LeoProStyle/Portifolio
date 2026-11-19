"""Soma das curvas de patrimônio das contas de uma sala."""

from app.office.curves import sum_curves


def test_soma_com_ultimo_valor_conhecido() -> None:
    curves = [(100.0, [(1, 110.0), (3, 120.0)]), (50.0, [(2, 40.0)])]
    # ts 1: 110 + 50 (inicial) · ts 2: 110 + 40 · ts 3: 120 + 40
    assert sum_curves(curves) == [(1, 160.0), (2, 150.0), (3, 160.0)]


def test_sem_curvas() -> None:
    assert sum_curves([]) == []
    assert sum_curves([(100.0, [])]) == []
