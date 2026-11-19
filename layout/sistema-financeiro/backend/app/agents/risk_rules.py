"""Regras de risco e de decisão em CÓDIGO (seções 6.4 e 6.5).

O LLM do Risco e do Gestor só pode ser igual ou mais conservador que isto:
- risco por operação ≤ MAX_RISK_PER_TRADE do patrimônio;
- exposição por ativo ≤ MAX_POSITION_PCT do patrimônio;
- stop = preço − ATR_STOP_MULT × ATR;
- perda do dia ≥ MAX_DAILY_LOSS → veta tudo até o próximo dia;
- sem venda a descoberto; qty nunca passa de max_qty.
"""

import math
from dataclasses import dataclass

from app.agents.schemas import Action, Decision, Proposal, RiskResult


@dataclass(frozen=True)
class RiskLimits:
    max_risk_per_trade: float
    max_position_pct: float
    max_daily_loss: float
    atr_stop_mult: float
    fee_pct: float
    slippage_pct: float


def floor_step(x: float, step: float) -> float:
    """Arredonda para baixo no passo (1 = ações inteiras; 0,0001 = cripto fracionária)."""
    if step == 1:
        return float(math.floor(x))
    decimals = max(0, -math.floor(math.log10(step)))
    return round(math.floor(x / step + 1e-9) * step, decimals)


@dataclass(frozen=True)
class BuySize:
    qty: float
    stop: float | None
    notes: str


def size_buy(
    *,
    price: float | None,
    atr: float | None,
    equity: float,
    cash: float,
    position_qty: float,
    limits: RiskLimits,
    qty_step: float = 1.0,
) -> BuySize:
    """Tamanho da compra: menor entre risco por operação, exposição e caixa (em código)."""
    if not price or price <= 0 or not atr or atr <= 0:
        return BuySize(0, None, "Sem preço ou ATR para calcular o stop.")
    stop = round(price - limits.atr_stop_mult * atr, 2)
    risk_per_share = price - stop
    if stop <= 0 or risk_per_share <= 0:
        return BuySize(0, None, "Stop calculado inválido.")
    by_risk = floor_step(equity * limits.max_risk_per_trade / risk_per_share, qty_step)
    room = equity * limits.max_position_pct - position_qty * price
    by_exposure = floor_step(max(room, 0) / price, qty_step)
    by_cash = floor_step(cash / (price * (1 + limits.fee_pct + limits.slippage_pct)), qty_step)
    qty = max(0.0, min(by_risk, by_exposure, by_cash))
    limiting = min(
        ("risco por operação", by_risk),
        ("exposição máxima por ativo", by_exposure),
        ("caixa disponível", by_cash),
        key=lambda item: item[1],
    )[0]
    unit = "ações" if qty_step == 1 else "unidades"
    shown = int(qty) if qty_step == 1 else qty
    notes = (
        f"Stop {stop:.2f} (preço {price:.2f} − {limits.atr_stop_mult:g}×ATR {atr:.2f}). "
        f"Máx. {shown} {unit}, limitado por {limiting}."
    )
    return BuySize(qty, stop, notes)


def evaluate_risk(
    action: Action,
    *,
    price: float | None,
    atr: float | None,
    equity: float,
    cash: float,
    position_qty: int,
    daily_pnl_pct: float,
    limits: RiskLimits,
) -> RiskResult:
    """Limites calculados em código para a proposta do Gestor."""
    if daily_pnl_pct <= -limits.max_daily_loss:
        return RiskResult(
            approved=False,
            max_qty=0,
            stop=None,
            notes=(
                f"Veto: perda diária de {daily_pnl_pct:.2%} atingiu o limite de "
                f"{limits.max_daily_loss:.0%}. Nada opera até o próximo dia."
            ),
        )

    if action == "ESPERA":
        return RiskResult(approved=True, max_qty=0, stop=None, notes="Nenhuma ordem proposta.")

    if action == "VENDA":
        if position_qty <= 0:
            return RiskResult(
                approved=False,
                max_qty=0,
                stop=None,
                notes="Sem posição: venda a descoberto não é permitida.",
            )
        return RiskResult(
            approved=True,
            max_qty=position_qty,
            stop=None,
            notes=f"Venda limitada à posição atual de {position_qty} ações.",
        )

    # COMPRA (ações inteiras)
    size = size_buy(
        price=price, atr=atr, equity=equity, cash=cash, position_qty=position_qty, limits=limits
    )
    max_qty = int(size.qty)
    return RiskResult(approved=max_qty > 0, max_qty=max_qty, stop=size.stop, notes=size.notes)


def apply_risk_limits(llm: RiskResult, rules: RiskResult) -> RiskResult:
    """Junta a opinião do LLM com os limites do código (o código sempre vence)."""
    approved = rules.approved and llm.approved
    max_qty = min(llm.max_qty, rules.max_qty) if approved else 0
    notes = rules.notes if not llm.notes else f"{llm.notes} | Regras: {rules.notes}"
    return RiskResult(approved=approved, max_qty=max_qty, stop=rules.stop, notes=notes[:600])


def finalize_decision(llm: Decision, proposal: Proposal, risk: RiskResult) -> Decision:
    """Validações finais do Gestor antes de qualquer ordem ir ao PaperBroker."""
    rationale = llm.rationale
    if not risk.approved:
        return Decision(
            action="ESPERA",
            ticker=llm.ticker,
            qty=0,
            stop=None,
            rationale=f"Risco não aprovou: {risk.notes}"[:600],
        )
    # o Gestor só pode manter a ação avaliada pelo Risco ou recuar para ESPERA
    action = llm.action if llm.action in (proposal.action, "ESPERA") else "ESPERA"
    if action != llm.action:
        rationale = (
            f"Ação final {llm.action} difere da proposta avaliada; mantida ESPERA. {rationale}"
        )
    qty = min(max(llm.qty, 0), risk.max_qty) if action != "ESPERA" else 0
    if action != "ESPERA" and qty == 0:
        action, rationale = "ESPERA", f"Quantidade final zero. {rationale}"
    if qty < llm.qty and action != "ESPERA":
        rationale = f"Quantidade cortada de {llm.qty} para {qty} (máx. do Risco). {rationale}"
    stop = risk.stop if action == "COMPRA" else None
    return Decision(action=action, ticker=llm.ticker, qty=qty, stop=stop, rationale=rationale[:600])
