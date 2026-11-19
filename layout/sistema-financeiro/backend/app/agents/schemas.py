"""Saídas estruturadas dos agentes (seção 6), validadas por Pydantic.

O LLM precisa devolver JSON exatamente nesse formato; fora disso há uma
nova tentativa e, se falhar de novo, o agente usa o resultado neutro.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Action = Literal["COMPRA", "VENDA", "ESPERA"]


class _Out(BaseModel):
    model_config = ConfigDict(extra="ignore")


class NewsResult(_Out):
    ticker: str
    sentiment: float = Field(ge=-1, le=1)
    confidence: float = Field(ge=0, le=1)
    key_points: list[str] = Field(default_factory=list, max_length=5)
    sources: list[str] = Field(default_factory=list, max_length=10)


class ChartResult(_Out):
    ticker: str
    trend: Literal["alta", "baixa", "lateral"]
    signal: float = Field(ge=-1, le=1)
    confidence: float = Field(ge=0, le=1)
    reasoning: str = Field(max_length=600)


class Proposal(_Out):
    """Proposta preliminar do Gestor, antes do Risco."""

    action: Action
    rationale: str = Field(default="", max_length=600)


class RiskResult(_Out):
    approved: bool
    max_qty: int = Field(ge=0)
    stop: float | None = None
    notes: str = Field(default="", max_length=600)


class Decision(_Out):
    action: Action
    ticker: str
    qty: int = Field(ge=0)
    stop: float | None = None
    rationale: str = Field(default="", max_length=600)
