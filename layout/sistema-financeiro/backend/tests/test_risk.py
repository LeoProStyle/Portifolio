"""Regras de risco em código: o LLM não consegue violar (seções 6.4, 6.5 e 15)."""

import pytest

from app.agents.risk_rules import RiskLimits, apply_risk_limits, evaluate_risk, finalize_decision
from app.agents.schemas import Decision, Proposal, RiskResult

LIMITS = RiskLimits(
    max_risk_per_trade=0.01,
    max_position_pct=0.20,
    max_daily_loss=0.03,
    atr_stop_mult=2.0,
    fee_pct=0.0003,
    slippage_pct=0.0005,
)


def _eval(action: str = "COMPRA", **kw: float) -> RiskResult:
    args = {
        "price": 50.0,
        "atr": 1.0,
        "equity": 100_000.0,
        "cash": 100_000.0,
        "position_qty": 0,
        "daily_pnl_pct": 0.0,
    }
    args.update(kw)
    return evaluate_risk(action, limits=LIMITS, **args)  # type: ignore[arg-type]


def test_compra_tamanho_pelo_risco_por_operacao() -> None:
    r = _eval()
    # stop = 50 - 2*1 = 48 ; risco por ação = 2 ; 1% de 100k = 1000 -> 500 ações
    # exposição máx 20% = 20.000 / 50 = 400 ações -> vence o menor: 400
    assert r.approved
    assert r.stop == pytest.approx(48)
    assert r.max_qty == 400


def test_compra_limitada_pelo_risco_quando_atr_alto() -> None:
    r = _eval(atr=5.0)  # risco por ação = 10 -> 1000/10 = 100 ações
    assert r.max_qty == 100


def test_compra_limitada_pelo_caixa() -> None:
    r = _eval(cash=1_000.0)
    assert r.max_qty == int(1_000 // (50 * (1 + 0.0003 + 0.0005)))


def test_exposicao_ja_existente_reduz_compra() -> None:
    r = _eval(position_qty=350)  # já tem 17.500 em carteira; cabe mais 2.500 -> 50 ações
    assert r.max_qty == 50


def test_exposicao_cheia_reprova() -> None:
    r = _eval(position_qty=400)
    assert not r.approved
    assert r.max_qty == 0


def test_sem_atr_reprova_compra() -> None:
    r = _eval(atr=None)  # type: ignore[arg-type]
    assert not r.approved


def test_perda_diaria_veta_tudo() -> None:
    for action in ("COMPRA", "VENDA"):
        r = _eval(action, daily_pnl_pct=-0.031, position_qty=10)
        assert not r.approved
        assert r.max_qty == 0
        assert "perda diária" in r.notes


def test_venda_limitada_a_posicao() -> None:
    r = _eval("VENDA", position_qty=30)
    assert r.approved and r.max_qty == 30


def test_venda_sem_posicao_reprova() -> None:
    assert not _eval("VENDA").approved


def test_espera_aprovada_sem_quantidade() -> None:
    r = _eval("ESPERA")
    assert r.approved and r.max_qty == 0


def test_llm_nao_aumenta_limites_do_codigo() -> None:
    regras = _eval()
    do_llm = RiskResult(approved=True, max_qty=99_999, stop=10.0, notes="pode tudo")
    final = apply_risk_limits(do_llm, regras)
    assert final.max_qty == regras.max_qty
    assert final.stop == regras.stop  # o stop vem sempre do código


def test_llm_pode_ser_mais_conservador() -> None:
    regras = _eval()
    do_llm = RiskResult(approved=False, max_qty=0, stop=None, notes="muito volátil")
    final = apply_risk_limits(do_llm, regras)
    assert not final.approved
    assert final.max_qty == 0


def test_llm_nao_aprova_o_que_o_codigo_vetou() -> None:
    regras = _eval(daily_pnl_pct=-0.05)
    do_llm = RiskResult(approved=True, max_qty=100, stop=48, notes="ignora")
    assert not apply_risk_limits(do_llm, regras).approved


# ---------- Gestor final ----------


def _decision(action: str, qty: int) -> Decision:
    return Decision(action=action, ticker="PETR4.SA", qty=qty, stop=1.0, rationale="x")  # type: ignore[arg-type]


def test_gestor_nunca_passa_de_max_qty() -> None:
    risk = RiskResult(approved=True, max_qty=40, stop=48.0, notes="")
    final = finalize_decision(
        _decision("COMPRA", 1_000), Proposal(action="COMPRA", rationale=""), risk
    )
    assert final.qty == 40
    assert final.stop == 48.0


def test_risco_reprovado_forca_espera() -> None:
    risk = RiskResult(approved=False, max_qty=0, stop=None, notes="veto")
    final = finalize_decision(
        _decision("COMPRA", 10), Proposal(action="COMPRA", rationale=""), risk
    )
    assert final.action == "ESPERA"
    assert final.qty == 0


def test_gestor_nao_troca_de_lado_sem_passar_pelo_risco() -> None:
    # proposta foi ESPERA (risco aprovou 0); o LLM final tenta COMPRA
    risk = RiskResult(approved=True, max_qty=0, stop=None, notes="")
    final = finalize_decision(
        _decision("COMPRA", 10), Proposal(action="ESPERA", rationale=""), risk
    )
    assert final.action == "ESPERA"


def test_quantidade_zero_vira_espera() -> None:
    risk = RiskResult(approved=True, max_qty=10, stop=48.0, notes="")
    final = finalize_decision(_decision("COMPRA", 0), Proposal(action="COMPRA", rationale=""), risk)
    assert final.action == "ESPERA" and final.qty == 0


def test_venda_nao_leva_stop() -> None:
    risk = RiskResult(approved=True, max_qty=30, stop=None, notes="")
    final = finalize_decision(_decision("VENDA", 30), Proposal(action="VENDA", rationale=""), risk)
    assert final.action == "VENDA" and final.qty == 30 and final.stop is None


def test_risco_com_quantidade_fracionaria() -> None:
    from app.agents.risk_rules import size_buy

    limits = RiskLimits(
        max_risk_per_trade=0.01,
        max_position_pct=0.20,
        max_daily_loss=0.03,
        atr_stop_mult=2,
        fee_pct=0.001,
        slippage_pct=0.0005,
    )
    r = size_buy(
        price=30000,
        atr=1000,
        equity=20000,
        cash=20000,
        position_qty=0,
        limits=limits,
        qty_step=0.0001,
    )
    # risco: 20000 × 1% / 2000 = 0,1; exposição: 20000 × 20% / 30000 = 0,1333
    assert r.qty == pytest.approx(0.1) and r.stop == 28000
