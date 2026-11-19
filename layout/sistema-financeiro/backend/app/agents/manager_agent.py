"""Gestor/Trader ("o decisor") — seção 6.5. Atua duas vezes no ciclo."""

from typing import Any

from app.agents.base import Agent, State
from app.agents.risk_rules import finalize_decision
from app.agents.schemas import Decision, Proposal


class ManagerProposalAgent(Agent[Proposal]):
    name = "manager"
    key = "manager_proposal"
    schema = Proposal

    def build_input(self, state: State) -> dict[str, Any] | None:
        return {
            "ticker": state["ticker"],
            "news": state["news"].model_dump(),
            "chart": state["chart"].model_dump(),
            "position_qty": state["portfolio"]["position_qty"],
        }

    def neutral(self, state: State) -> Proposal:
        return Proposal(action="ESPERA", rationale="Sem proposta válida; por segurança, espera.")

    def postprocess(
        self, result: Proposal, state: State, payload: dict[str, Any] | None
    ) -> Proposal:
        if result.action == "VENDA" and state["portfolio"]["position_qty"] == 0:
            rationale = f"Venda sem posição não é permitida. {result.rationale}"
            return Proposal(action="ESPERA", rationale=rationale[:600])
        return result

    def bubble(self, result: Proposal) -> str:
        return f"Proposta preliminar: {result.action}. {result.rationale}"


class ManagerFinalAgent(Agent[Decision]):
    name = "manager"
    key = "manager_final"
    schema = Decision

    def build_input(self, state: State) -> dict[str, Any] | None:
        return {
            "ticker": state["ticker"],
            "proposal": state["proposal"].model_dump(),
            "risk": state["risk"].model_dump(),
            "news": state["news"].model_dump(),
            "chart": state["chart"].model_dump(),
        }

    def neutral(self, state: State) -> Decision:
        return Decision(
            action="ESPERA",
            ticker=state["ticker"],
            qty=0,
            stop=None,
            rationale="Sem decisão válida; por segurança, espera.",
        )

    def postprocess(
        self, result: Decision, state: State, payload: dict[str, Any] | None
    ) -> Decision:
        result = result.model_copy(update={"ticker": state["ticker"]})
        # validações em código: Risco reprovado -> ESPERA; qty <= max_qty
        return finalize_decision(result, state["proposal"], state["risk"])

    def bubble(self, result: Decision) -> str:
        if result.action == "ESPERA":
            return f"Decisão: ESPERA. {result.rationale}"
        return f"Decisão: {result.action} {result.qty} {result.ticker}. {result.rationale}"
