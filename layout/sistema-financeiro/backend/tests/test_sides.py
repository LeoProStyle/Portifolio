"""Sinais dos dois lados (comprado/vendido) e tamanho em contratos."""

import pandas as pd
import pytest

from app.broker.futures import ContractSpec
from app.strategies.base import Signal
from app.strategies.exits import plan_exit
from app.strategies.sides import combine, invert, size_contracts

WIN = ContractSpec(
    multiplier=0.2, fee_per_contract=0.5, margin_per_contract=4000, slippage_points=5
)
BUY = Signal("COMPRA", "alta")
SELL = Signal("VENDA", "saída")
HOLD = Signal("ESPERA", "nada")


def test_invert_troca_alta_e_baixa() -> None:
    c = pd.DataFrame({"open": [4.0], "high": [5.0], "low": [2.0], "close": [4.0], "volume": [7.0]})
    inv = invert(c)
    # espelho em torno do último fechamento (K = 4² = 16): mesma escala de preço
    assert inv["close"].iloc[0] == 4.0 and inv["open"].iloc[0] == 4.0
    assert inv["high"].iloc[0] == 8.0 and inv["low"].iloc[0] == 3.2  # K/mínima e K/máxima
    assert inv["volume"].iloc[0] == 7.0


def test_combine_zerado_compra_ou_vende() -> None:
    assert combine(0, BUY, HOLD).kind == "comprar"
    assert combine(0, HOLD, BUY).kind == "vender"  # "compra" na série invertida = vender
    assert combine(0, BUY, BUY).kind == "comprar"  # empate: o lado comprado tem prioridade
    assert combine(0, HOLD, None).kind == "esperar"


def test_combine_posicionado_so_zera_pelo_proprio_lado() -> None:
    assert combine(2, SELL, HOLD).kind == "zerar"
    assert combine(2, HOLD, BUY).kind == "esperar"  # sem virar a mão
    assert combine(-1, HOLD, SELL).kind == "zerar"
    assert combine(-1, BUY, HOLD).kind == "esperar"
    assert "vendido" in combine(0, HOLD, BUY).reason


def test_plano_de_saida_do_vendido() -> None:
    plan = plan_exit(100.0, 1.0, atr_mult=2, r_multiple=2, side="VENDA")
    assert plan.stop == 102.0 and plan.target == 96.0
    assert plan_exit(100.0, 1.0).stop == 98.0  # comprado continua igual


def test_tamanho_em_contratos_pelo_risco_e_pela_margem() -> None:
    # risco por contrato = 3000 pontos × 0,20 = R$ 600; 1% de 100 mil = R$ 1.000 → 1 contrato
    qty, _ = size_contracts(100_000, 100_000, 120000, 123000, WIN, 0.01, 0.0, 0.03)
    assert qty == 1
    # risco largo → margem limita: 6.000 livres / (4.000 + 0,50) = 1
    qty, notes = size_contracts(1_000_000, 6_000, 120000, 120100, WIN, 0.01, 0.0, 0.03)
    assert qty == 1 and "margem" in notes
    qty, notes = size_contracts(100_000, 100_000, 120000, 123000, WIN, 0.01, -0.031, 0.03)
    assert qty == 0 and "perda do dia" in notes
    qty, _ = size_contracts(100_000, 100_000, 120000, 120000, WIN, 0.01, 0.0, 0.03)
    assert qty == 0


@pytest.mark.parametrize("side", ["COMPRA", "VENDA"])
def test_plano_recusa_atr_zero(side: str) -> None:
    with pytest.raises(ValueError):
        plan_exit(100.0, 0.0, side=side)  # type: ignore[arg-type]


def test_motivo_do_tamanho_em_formato_brasileiro() -> None:
    _, notes = size_contracts(100_000, 100_000, 5782.6, 5592.5, WIN, 0.01, 0.0, 0.03)
    assert "R$ 39,02/contrato" in notes and "R$ 100.000" in notes
