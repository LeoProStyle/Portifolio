"""Testes do contrato de eventos WebSocket (seção 8 do CLAUDE.md)."""

import asyncio
import uuid

import pytest
from pydantic import ValidationError

from app.events import EVENT_TYPES, EventBus, event_adapter, make_event


def test_make_event_preenche_envelope() -> None:
    cycle_id = uuid.uuid4()
    event = make_event("cycle_started", cycle_id, {"ticker": "PETR4.SA"})

    data = event.model_dump(mode="json")
    assert data["type"] == "cycle_started"
    assert data["cycle_id"] == str(cycle_id)
    assert data["payload"] == {"ticker": "PETR4.SA"}
    # timestamp com fuso de Brasília
    assert data["ts"].endswith("-03:00")


def test_payload_invalido_e_rejeitado() -> None:
    with pytest.raises(ValidationError):
        make_event("agent_status", uuid.uuid4(), {"agent": "news", "status": "dormindo"})


def test_tipo_desconhecido_e_rejeitado() -> None:
    with pytest.raises(ValidationError):
        event_adapter.validate_python(
            {
                "type": "comprar_tudo",
                "ts": "2026-11-18T14:00:00-03:00",
                "cycle_id": None,
                "payload": {},
            }
        )


def test_todos_os_tipos_do_contrato_existem() -> None:
    esperados = {
        "cycle_started",
        "agent_status",
        "agent_message",
        "agent_result",
        "decision",
        "order_filled",
        "portfolio_update",
        "price_update",
        "risk_veto",
        "budget_warning",
        "cycle_finished",
    }
    assert set(EVENT_TYPES) == esperados


def test_agent_message_rejeita_texto_vazio() -> None:
    with pytest.raises(ValidationError):
        make_event("agent_message", uuid.uuid4(), {"agent": "news", "text": ""})


def test_event_bus_entrega_para_todos_inscritos() -> None:
    async def cenario() -> None:
        bus = EventBus()
        event = make_event("cycle_started", uuid.uuid4(), {"ticker": "VALE3.SA"})
        async with bus.subscribe() as fila_a, bus.subscribe() as fila_b:
            await bus.publish(event)
            assert (await fila_a.get()) is event
            assert (await fila_b.get()) is event
        assert bus.subscriber_count == 0

    asyncio.run(cenario())


def test_recorder_que_falha_nao_impede_entrega(caplog) -> None:
    def quebra(_event) -> None:
        raise RuntimeError("disco cheio")

    async def cenario() -> None:
        bus = EventBus(recorder=quebra)
        event = make_event("cycle_started", uuid.uuid4(), {"ticker": "PETR4.SA"})
        async with bus.subscribe() as fila:
            await bus.publish(event)
            assert (await fila.get()) is event

    asyncio.run(cenario())
    assert "disco cheio" in caplog.text
