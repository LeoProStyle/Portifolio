"""Camada de abstração do LLM.

Cada agente chama `provider.complete(agent=..., system=..., user=...)` e recebe
texto (que deve ser JSON) mais a contagem de tokens. Trocar de provedor não
muda nada nos agentes.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.config import Settings


@dataclass(frozen=True)
class LLMResponse:
    text: str
    input_tokens: int
    output_tokens: int


class LLMProvider(Protocol):
    name: str

    async def complete(self, *, agent: str, system: str, user: str) -> LLMResponse: ...


def create_provider(settings: "Settings") -> LLMProvider:
    if settings.llm_provider == "mock":
        from app.llm.mock import MockProvider

        return MockProvider()
    raise NotImplementedError(
        f"LLM_PROVIDER={settings.llm_provider} ainda não está disponível: os provedores reais "
        "(Anthropic/OpenAI) entram na Fase 5. Use LLM_PROVIDER=mock."
    )
