"""Grafo LangGraph de um ciclo de decisão (seção 6, "Fluxo do grafo").

    START → [Notícias ∥ Gráfico] → Gestor (proposta) → Risco → Gestor (final) → Execução → END

Notícias e Gráfico rodam em paralelo. O debate Otimista × Pessimista entra
entre eles e o Gestor na Fase 5.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.chart_agent import ChartAgent
from app.agents.manager_agent import ManagerFinalAgent, ManagerProposalAgent
from app.agents.news_agent import NewsAgent
from app.agents.risk_agent import RiskAgent
from app.agents.risk_rules import RiskLimits
from app.agents.schemas import ChartResult, Decision, NewsResult, Proposal, RiskResult


class CycleState(TypedDict, total=False):
    # entrada (montada pelo CycleRunner, só com dados <= now)
    ticker: str
    now: datetime
    news_items: list[dict[str, Any]]
    indicators: dict[str, Any]
    price: float | None
    portfolio: dict[str, Any]
    limits: RiskLimits
    # saídas dos agentes
    news: NewsResult
    chart: ChartResult
    proposal: Proposal
    risk: RiskResult
    decision: Decision
    order_id: str | None


@dataclass(frozen=True)
class CycleAgents:
    news: NewsAgent
    chart: ChartAgent
    proposal: ManagerProposalAgent
    risk: RiskAgent
    final: ManagerFinalAgent


Executor = Callable[[Decision], Awaitable[str | None]]


def build_cycle_graph(agents: CycleAgents, execute: Executor) -> CompiledStateGraph:
    async def noticias(state: CycleState) -> dict[str, Any]:
        return {"news": await agents.news.run(dict(state))}

    async def grafico(state: CycleState) -> dict[str, Any]:
        return {"chart": await agents.chart.run(dict(state))}

    async def proposta(state: CycleState) -> dict[str, Any]:
        return {"proposal": await agents.proposal.run(dict(state))}

    async def risco(state: CycleState) -> dict[str, Any]:
        return {"risk": await agents.risk.run(dict(state))}

    async def decisao(state: CycleState) -> dict[str, Any]:
        return {"decision": await agents.final.run(dict(state))}

    async def execucao(state: CycleState) -> dict[str, Any]:
        return {"order_id": await execute(state["decision"])}

    graph = StateGraph(CycleState)
    graph.add_node("noticias", noticias)
    graph.add_node("grafico", grafico)
    graph.add_node("proposta", proposta)
    graph.add_node("risco", risco)
    graph.add_node("decisao", decisao)
    graph.add_node("execucao", execucao)

    graph.add_edge(START, "noticias")
    graph.add_edge(START, "grafico")
    graph.add_edge(["noticias", "grafico"], "proposta")  # espera os dois terminarem
    graph.add_edge("proposta", "risco")
    graph.add_edge("risco", "decisao")
    graph.add_edge("decisao", "execucao")
    graph.add_edge("execucao", END)
    return graph.compile()
