"""Os dois lados de um robô de minicontratos (comprado e vendido).

As estratégias são "long-only" e puras. O lado vendido é a MESMA estratégia
aplicada à série espelhada (K/preço): o que cai na série real sobe na espelhada.
Assim um cruzamento de médias para baixo vira "COMPRA" na série invertida =
abrir vendido. Os números citados no motivo do lado vendido são da série
espelhada. Indicadores continuam calculados em código (regra 4).
"""

from dataclasses import dataclass
from typing import Literal

import pandas as pd

from app.broker.futures import ContractSpec
from app.strategies.base import Signal


def invert(candles: pd.DataFrame) -> pd.DataFrame:
    """Série espelhada K/preço, com K = (último fechamento)².

    O que cai na série real sobe na espelhada; no último candle o preço é o mesmo,
    então os números do motivo (médias, níveis) ficam na escala do preço real.
    Máxima vira K/mínima e mínima vira K/máxima; volume igual.
    """
    if candles.empty:
        return candles.copy()
    k = float(candles["close"].iloc[-1]) ** 2
    out = candles.copy()
    out["open"] = k / candles["open"]
    out["close"] = k / candles["close"]
    out["high"] = k / candles["low"]
    out["low"] = k / candles["high"]
    return out


IntentKind = Literal["comprar", "vender", "zerar", "esperar"]


@dataclass(frozen=True)
class Intent:
    kind: IntentKind
    reason: str


def combine(position: int, long_sig: Signal, short_sig: Signal | None) -> Intent:
    """Decide com a posição atual. Só abre a partir de zerado; só zera pelo próprio lado."""
    short_txt = f" | vendido: {short_sig.reason}" if short_sig else ""
    if position > 0:
        if long_sig.action == "VENDA":
            return Intent("zerar", f"comprado: {long_sig.reason}")
        return Intent("esperar", f"comprado: {long_sig.reason}")
    if position < 0:
        if short_sig is not None and short_sig.action == "VENDA":
            return Intent("zerar", f"vendido: {short_sig.reason}")
        return Intent("esperar", f"vendido: {short_sig.reason if short_sig else '—'}")
    if long_sig.action == "COMPRA":
        return Intent("comprar", f"comprado: {long_sig.reason}")
    if short_sig is not None and short_sig.action == "COMPRA":
        return Intent("vender", f"vendido (série espelhada): {short_sig.reason}")
    return Intent("esperar", f"comprado: {long_sig.reason}{short_txt}")


def _brl(v: float, decimals: int) -> str:
    """1234.5 → "1.234,50" (formato brasileiro, para os motivos na tela)."""
    us = f"{v:,.{decimals}f}"
    return us.replace(",", "_").replace(".", ",").replace("_", ".")


def size_contracts(
    equity: float,
    free_margin: float,
    entry: float,
    stop: float,
    spec: ContractSpec,
    max_risk: float,
    daily_pnl_pct: float,
    max_daily_loss: float,
) -> tuple[int, str]:
    """Contratos inteiros: o menor entre o risco permitido e a margem livre."""
    if daily_pnl_pct <= -max_daily_loss:
        return 0, f"perda do dia {daily_pnl_pct:.2%} atingiu o limite de {max_daily_loss:.0%}"
    risk_per_contract = abs(entry - stop) * spec.multiplier + 2 * spec.fee_per_contract
    if abs(entry - stop) <= 0:
        return 0, "stop igual à entrada"
    by_risk = int((equity * max_risk) // risk_per_contract)
    by_margin = int(max(0.0, free_margin) // (spec.margin_per_contract + spec.fee_per_contract))
    qty = min(by_risk, by_margin)
    notes = (
        f"risco R$ {_brl(risk_per_contract, 2)}/contrato → até {by_risk}; "
        f"margem livre R$ {_brl(free_margin, 0)} → até {by_margin}"
    )
    return max(qty, 0), notes
