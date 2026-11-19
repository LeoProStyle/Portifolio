"""Métricas do backtest (funções puras, sem banco).

- Drawdown máximo: maior queda do pico ao vale da curva de patrimônio.
- Operação fechada ("round trip"): da primeira compra até a posição zerar.
  O resultado já desconta taxas das duas pontas (preço médio com taxa).
- Fator de lucro: soma dos ganhos ÷ soma das perdas.
- Veredito: checagens do critério de "candidato" (spec §8), com regras de amostra
  adaptadas do Trader skill v2 (Jake Schincariol, MIT). "Passou no backtest" NÃO
  quer dizer pronto para conta real: falta a simulação ao vivo de 3 meses.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any

MIN_PERIOD_DAYS = 730  # 2 anos


@dataclass(frozen=True)
class Fill:
    ts: datetime
    side: str  # COMPRA | VENDA
    qty: int
    price: float
    fee: float
    reason: str  # decisao | stop | alvo


@dataclass(frozen=True)
class Trade:
    opened: datetime
    closed: datetime
    pnl: float
    fees: float
    reason: str  # motivo da saída


@dataclass(frozen=True)
class Metrics:
    initial_cash: float
    final_equity: float
    total_return: float
    max_drawdown: float
    trades: int
    wins: int
    losses: int
    win_rate: float | None
    profit_factor: float | None
    avg_trade: float | None
    fees_paid: float
    slippage_paid: float
    costs_paid: float
    asset_return: float | None
    index_return: float | None
    excess_vs_asset: float | None
    excess_vs_index: float | None
    llm_cost: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Check:
    name: str
    label: str
    ok: bool | None  # None = sem dados para julgar (não reprova)
    detail: str


@dataclass(frozen=True)
class Verdict:
    passed: bool
    checks: list[Check] = field(default_factory=list)
    note: str = (
        "Passar no backtest não libera conta real: o critério exige também 3 meses "
        "de simulação ao vivo com a mesma configuração."
    )

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def max_drawdown(equity: list[float]) -> float:
    peak = 0.0
    worst = 0.0
    for value in equity:
        peak = max(peak, value)
        if peak > 0:
            worst = max(worst, 1 - value / peak)
    return worst


def round_trips(fills: list[Fill], multiplier: float = 1.0) -> list[Trade]:
    """Operações completas (abre → zera), com taxas.

    Ações: só comprado (venda sem posição é ignorada). Minicontratos
    (`multiplier` ≠ 1): também vendido; resultado = pontos × qtd × multiplicador.
    """
    allow_short = multiplier != 1.0
    trades: list[Trade] = []
    pos = 0
    avg = 0.0
    pnl = 0.0
    fees = 0.0
    opened: datetime | None = None
    for f in sorted(fills, key=lambda x: x.ts):
        delta = f.qty if f.side == "COMPRA" else -f.qty
        if pos == 0 and delta < 0 and not allow_short:
            continue  # venda sem posição (não deveria acontecer em ações): ignora
        if pos == 0:
            opened, pnl, fees = f.ts, 0.0, 0.0
        pnl -= f.fee
        fees += f.fee
        if pos == 0 or (pos > 0) == (delta > 0):
            avg = (avg * abs(pos) + f.price * abs(delta)) / (abs(pos) + abs(delta))
            pos += delta
            continue
        closed = min(abs(delta), abs(pos))
        direction = 1 if pos > 0 else -1
        pnl += (f.price - avg) * closed * multiplier * direction
        pos -= direction * closed
        if pos == 0 and opened is not None:
            trades.append(Trade(opened, f.ts, pnl, fees, f.reason))
    return trades


def _excess(total: float, bench: float | None) -> float | None:
    return None if bench is None else total - bench


def compute_metrics(
    initial_cash: float,
    equity: list[float],
    trades: list[Trade],
    fees_paid: float,
    slippage_paid: float,
    asset_return: float | None,
    index_return: float | None,
) -> Metrics:
    final = equity[-1] if equity else initial_cash
    total = final / initial_cash - 1 if initial_cash else 0.0
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [-t.pnl for t in trades if t.pnl <= 0]
    gross_loss = sum(losses)
    return Metrics(
        initial_cash=initial_cash,
        final_equity=final,
        total_return=total,
        max_drawdown=max_drawdown(equity),
        trades=len(trades),
        wins=len(wins),
        losses=len(losses),
        win_rate=len(wins) / len(trades) if trades else None,
        profit_factor=sum(wins) / gross_loss if gross_loss > 0 else None,
        avg_trade=sum(t.pnl for t in trades) / len(trades) if trades else None,
        fees_paid=fees_paid,
        slippage_paid=slippage_paid,
        costs_paid=fees_paid + slippage_paid,
        asset_return=asset_return,
        index_return=index_return,
        excess_vs_asset=_excess(total, asset_return),
        excess_vs_index=_excess(total, index_return),
    )


def _pct(v: float) -> str:
    return f"{v * 100:.2f}%".replace(".", ",")


def _beats(name: str, label: str, total: float, bench: float | None) -> Check:
    if bench is None:
        return Check(name, label, None, "sem dados do benchmark no período")
    return Check(name, label, total > bench, f"robô {_pct(total)} × {_pct(bench)}")


def verdict(m: Metrics, period_days: int, *, max_dd: float, min_trades: int) -> Verdict:
    pf_label = "Fator de lucro > 1"
    if m.profit_factor is not None:
        pf = Check(
            "fator_lucro", pf_label, m.profit_factor > 1, f"{m.profit_factor:.2f}".replace(".", ",")
        )
    elif m.wins > 0:
        pf = Check("fator_lucro", pf_label, True, "sem operações perdedoras")
    else:
        pf = Check("fator_lucro", pf_label, False, "sem operações vencedoras")
    checks = [
        Check(
            "periodo",
            "Backtest de pelo menos 2 anos",
            period_days >= MIN_PERIOD_DAYS,
            f"{period_days} dias",
        ),
        _beats(
            "bate_ativo",
            "Bate comprar e segurar o ativo (após custos)",
            m.total_return,
            m.asset_return,
        ),
        _beats("bate_indice", "Bate o Ibovespa (após custos)", m.total_return, m.index_return),
        Check(
            "drawdown",
            f"Drawdown máximo até {_pct(max_dd)}",
            m.max_drawdown <= max_dd,
            _pct(m.max_drawdown),
        ),
        Check(
            "amostra",
            f"Pelo menos {min_trades} operações fechadas",
            m.trades >= min_trades,
            f"{m.trades} operações",
        ),
        pf,
    ]
    return Verdict(passed=all(c.ok is not False for c in checks), checks=checks)
