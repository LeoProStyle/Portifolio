"""Classe base dos agentes (seção 6).

Cada agente = prompt de papel (agents/prompts/*.md) + entrada montada em código
+ saída JSON validada por Pydantic. Fluxo de `run`:

  agent_status=thinking → monta a entrada → chama o LLM
  → JSON inválido? UMA nova tentativa → falhou de novo? resultado neutro + erro registrado
  → pós-processamento em código (regras que o LLM não pode violar)
  → agent_message (balão) → agent_result → agent_status=done
"""

import json
import logging
import re
from collections.abc import Awaitable, Callable
from functools import cache
from pathlib import Path
from typing import Any, ClassVar

from pydantic import BaseModel, ValidationError

from app.llm.budget import Usage
from app.llm.provider import LLMProvider

log = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"
MAX_ATTEMPTS = 2  # a primeira + uma nova tentativa

Emitter = Callable[[str, dict[str, Any]], Awaitable[None]]
State = dict[str, Any]


class InvalidLLMOutput(ValueError):
    pass


@cache
def load_prompt(key: str) -> str:
    return (PROMPTS_DIR / f"{key}.md").read_text(encoding="utf-8")


def extract_json(text: str) -> dict[str, Any]:
    """Aceita JSON puro, dentro de ```json``` ou cercado de texto."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise InvalidLLMOutput("nenhum objeto JSON na resposta")
    try:
        data = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise InvalidLLMOutput(f"JSON malformado: {exc}") from exc
    if not isinstance(data, dict):
        raise InvalidLLMOutput("a resposta não é um objeto JSON")
    return data


def _json_default(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[no-any-return]
    raise TypeError(f"não serializável: {type(value)}")


class Agent[T: BaseModel]:
    name: ClassVar[str]  # nome do boneco nos eventos (news, chart, risk, manager)
    key: ClassVar[str]  # prompt e handler do provider
    schema: ClassVar[type[BaseModel]]

    def __init__(self, provider: LLMProvider, emit: Emitter, usage: Usage) -> None:
        self._provider = provider
        self._emit = emit
        self._usage = usage

    # ---------- pontos de extensão ----------

    def build_input(self, state: State) -> dict[str, Any] | None:
        """Entrada enviada ao LLM. None = sem dados → resultado neutro sem chamar o LLM."""
        raise NotImplementedError

    def neutral(self, state: State) -> T:
        raise NotImplementedError

    def postprocess(self, result: T, state: State, payload: dict[str, Any] | None) -> T:
        return result

    def bubble(self, result: T) -> str:
        return "Pronto."

    async def after(self, result: T, state: State) -> None:
        """Eventos extras depois do resultado (ex.: risk_veto)."""

    # ---------- execução ----------

    async def run(self, state: State) -> T:
        await self._status("thinking")
        payload = self.build_input(state)
        failed = False
        if payload is None:
            result = self.neutral(state)
        else:
            parsed = await self._ask(payload)
            if parsed is None:
                failed = True
                result = self.neutral(state)
            else:
                result = parsed
        result = self.postprocess(result, state, payload)

        if failed:
            await self._emit(
                "agent_message",
                {
                    "agent": self.name,
                    "text": "Não consegui ler a resposta do modelo; usei o resultado neutro.",
                },
            )
        await self._emit("agent_message", {"agent": self.name, "text": self.bubble(result)})
        await self._emit(
            "agent_result", {"agent": self.name, "result": result.model_dump(mode="json")}
        )
        await self.after(result, state)
        await self._status("error" if failed else "done")
        return result

    async def _ask(self, payload: dict[str, Any]) -> T | None:
        user = json.dumps(payload, ensure_ascii=False, default=_json_default)
        system = load_prompt(self.key)
        for attempt in range(1, MAX_ATTEMPTS + 1):
            resp = await self._provider.complete(agent=self.key, system=system, user=user)
            self._usage.add(resp)
            try:
                return self.schema.model_validate(extract_json(resp.text))  # type: ignore[return-value]
            except (InvalidLLMOutput, ValidationError) as exc:
                msg = f"{self.key}: resposta inválida na tentativa {attempt}: {exc}"
                log.warning(msg)
                self._usage.errors.append(msg[:300])
        return None

    async def _status(self, status: str) -> None:
        await self._emit("agent_status", {"agent": self.name, "status": status})
