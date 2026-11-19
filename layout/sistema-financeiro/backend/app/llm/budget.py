"""Contagem de tokens e custo estimado por ciclo (seção 11).

Fase 3: só soma tokens/custo do ciclo. O limite diário (MAX_COST_PER_DAY),
o `budget_warning` e o cache de respostas entram na Fase 5.
"""

from dataclasses import dataclass, field

from app.llm.provider import LLMResponse


@dataclass
class Usage:
    price_per_mtok_input: float = 0.0
    price_per_mtok_output: float = 0.0
    billable: bool = True
    input_tokens: int = 0
    output_tokens: int = 0
    calls: int = 0
    errors: list[str] = field(default_factory=list)

    def add(self, resp: LLMResponse) -> None:
        self.calls += 1
        self.input_tokens += resp.input_tokens
        self.output_tokens += resp.output_tokens

    @property
    def tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def cost(self) -> float:
        if not self.billable:
            return 0.0
        return (
            self.input_tokens / 1_000_000 * self.price_per_mtok_input
            + self.output_tokens / 1_000_000 * self.price_per_mtok_output
        )
