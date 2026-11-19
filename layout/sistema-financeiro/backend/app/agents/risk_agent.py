"""Agente Risco ("o freio") — seção 6.4.

Os limites são calculados em código (`evaluate_risk`) ANTES do LLM e
aplicados de novo DEPOIS (`apply_risk_limits`): o LLM só pode ser mais
conservador.
"""

from typing import Any

from app.agents.base import Agent, State
from app.agents.risk_rules import apply_risk_limits, evaluate_risk
from app.agents.schemas import RiskResult


class RiskAgent(Agent[RiskResult]):
    name = "risk"
    key = "risk"
    schema = RiskResult

    def _rules(self, state: State) -> RiskResult:
        pf = state["portfolio"]
        return evaluate_risk(
            state["proposal"].action,
            price=state.get("price"),
            atr=(state.get("indicators") or {}).get("atr14"),
            equity=pf["equity"],
            cash=pf["cash"],
            position_qty=pf["position_qty"],
            daily_pnl_pct=pf["daily_pnl_pct"],
            limits=state["limits"],
        )

    def build_input(self, state: State) -> dict[str, Any] | None:
        indicators = state.get("indicators") or {}
        return {
            "ticker": state["ticker"],
            "proposal": state["proposal"].model_dump(),
            "price": state.get("price"),
            "atr14": indicators.get("atr14"),
            "vol20": indicators.get("vol20"),
            "portfolio": state["portfolio"],
            "rules": self._rules(state).model_dump(),
        }

    def neutral(self, state: State) -> RiskResult:
        # sem parecer válido do LLM, a opção segura é não operar
        return RiskResult(
            approved=False, max_qty=0, stop=None, notes="Sem parecer válido do Risco."
        )

    def postprocess(
        self, result: RiskResult, state: State, payload: dict[str, Any] | None
    ) -> RiskResult:
        return apply_risk_limits(result, self._rules(state))

    def bubble(self, result: RiskResult) -> str:
        if result.approved and result.max_qty > 0:
            return f"Aprovado: até {result.max_qty} ações, stop {result.stop}."
        if result.approved:
            return "Nada a aprovar: nenhuma ordem proposta."
        return f"PARE! {result.notes}"

    async def after(self, result: RiskResult, state: State) -> None:
        daily_veto = state["portfolio"]["daily_pnl_pct"] <= -state["limits"].max_daily_loss
        if not result.approved and (state["proposal"].action != "ESPERA" or daily_veto):
            await self._emit("risk_veto", {"reason": result.notes or "Reprovado pelo Risco."})
