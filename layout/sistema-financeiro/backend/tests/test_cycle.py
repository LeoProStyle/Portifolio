"""Ciclo completo com MockProvider: grafo, eventos, broker, look-ahead e veto."""

import asyncio
import uuid
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.clock import SimulatedClock
from app.config import Settings
from app.cycle import LookAheadError, assert_no_future
from app.events import event_adapter
from app.main import Runtime, build_runtime, create_app
from tests.fakes import NOW, FakeFeeds, FakePrices, SpyProvider, iter_timestamps


def _settings(**kw: Any) -> Settings:
    return Settings(_env_file=None, database_url="sqlite://", **kw)


def _runtime(trend: str = "alta", provider: Any = None) -> Runtime:
    clock = SimulatedClock(NOW)
    return build_runtime(
        _settings(),
        price_fetcher=FakePrices(trend),
        feed_fetcher=FakeFeeds(),
        clock=clock,
        provider=provider,
        # os dados são "baixados" no instante simulado (coerente com DATA-001)
        wall_clock=lambda: clock.now().timestamp(),
    )


async def _run_cycle(rt: Runtime, ticker: str = "PETR4.SA") -> tuple[Any, list[dict[str, Any]]]:
    events: list[dict[str, Any]] = []
    async with rt.bus.subscribe() as queue:
        decision = await rt.runner.run(ticker, uuid.uuid4())
        while not queue.empty():
            events.append(queue.get_nowait().model_dump(mode="json"))
    return decision, events


def test_ciclo_completo_em_alta_gera_compra_pendente() -> None:
    rt = _runtime("alta")
    decision, events = asyncio.run(_run_cycle(rt))

    for e in events:
        event_adapter.validate_python(e)  # contrato WS
    tipos = [e["type"] for e in events]
    assert tipos[0] == "cycle_started" and tipos[-1] == "cycle_finished"
    assert "decision" in tipos and "portfolio_update" in tipos

    assert decision.action == "COMPRA"
    assert decision.qty > 0 and decision.stop is not None
    pendentes = rt.broker.list_orders(status="pending")
    assert len(pendentes) == 1 and pendentes[0].qty == decision.qty

    finished = events[-1]["payload"]
    assert finished["cost"] == 0  # MockProvider não tem custo
    assert finished["tokens"] > 0


def test_noticias_e_grafico_rodam_antes_do_gestor() -> None:
    _, events = asyncio.run(_run_cycle(_runtime()))
    status = [
        (e["payload"]["agent"], e["payload"]["status"])
        for e in events
        if e["type"] == "agent_status"
    ]
    primeiro_gestor = status.index(("manager", "thinking"))
    antes = set(status[:primeiro_gestor])
    assert {("news", "done"), ("chart", "done")} <= antes
    ordem = [a for a, s in status if s == "thinking"]
    assert ordem.index("risk") > ordem.index("manager")  # proposta -> risco -> final


def test_quantidade_respeita_limite_de_risco() -> None:
    rt = _runtime("alta")
    decision, events = asyncio.run(_run_cycle(rt))
    risco = next(
        e["payload"]["result"]
        for e in events
        if e["type"] == "agent_result" and e["payload"]["agent"] == "risk"
    )
    assert decision.qty <= risco["max_qty"]
    # 20% do patrimônio no máximo
    assert decision.qty * 40 <= 0.20 * 100_000 * 1.01


def test_em_baixa_sem_posicao_espera() -> None:
    decision, events = asyncio.run(_run_cycle(_runtime("baixa")))
    assert decision.action == "ESPERA"
    assert not any(e["type"] == "risk_veto" for e in events)


def test_ordem_executa_no_proximo_candle_em_outro_ciclo() -> None:
    rt = _runtime("alta")
    decision, _ = asyncio.run(_run_cycle(rt))
    assert decision.action == "COMPRA"
    # ordem criada em 18/11 às 14h: o candle de 18/11 abriu ANTES dela, então ela
    # executa na abertura de 19/11 (visível quando esse candle fecha)
    rt.clock.advance(timedelta(days=2))  # type: ignore[attr-defined]
    _, events = asyncio.run(_run_cycle(rt))
    fills = [e for e in events if e["type"] == "order_filled"]
    assert len(fills) == 1
    assert fills[0]["payload"]["time"].startswith("2026-11-19")
    assert rt.broker.position_qty("PETR4.SA") == decision.qty


def test_perda_diaria_veta_e_forca_espera() -> None:
    rt = _runtime("alta")
    rt.broker.daily_pnl_pct = lambda *_a, **_k: -0.05  # type: ignore[method-assign]
    decision, events = asyncio.run(_run_cycle(rt))
    assert decision.action == "ESPERA"
    assert any(e["type"] == "risk_veto" for e in events)
    assert rt.broker.list_orders(status="pending") == []


def test_nenhum_agente_recebe_dado_do_futuro() -> None:
    spy = SpyProvider()
    rt = _runtime("alta", provider=spy)
    asyncio.run(_run_cycle(rt))
    assert {a for a, _ in spy.inputs} == {
        "news",
        "chart",
        "manager_proposal",
        "risk",
        "manager_final",
    }
    for agent, payload in spy.inputs:
        for ts in iter_timestamps(payload):
            assert ts <= NOW, f"{agent} recebeu {ts.isoformat()} > {NOW.isoformat()}"


def test_assert_no_future_detecta_vazamento() -> None:
    futuro = (NOW + timedelta(hours=1)).isoformat()
    with pytest.raises(LookAheadError):
        assert_no_future({"indicators": {"last_candle": {"time": futuro}}}, NOW)
    with pytest.raises(LookAheadError):
        assert_no_future({"news_items": [{"published": futuro}]}, NOW)


def test_eventos_ficam_gravados_no_banco() -> None:
    rt = _runtime()
    _, events = asyncio.run(_run_cycle(rt))
    gravados = rt.events.recent(1000)
    assert [e["type"] for e in gravados] == [e["type"] for e in events]


def test_provider_real_ainda_nao_disponivel() -> None:
    with pytest.raises(NotImplementedError):
        build_runtime(
            _settings(llm_provider="anthropic"),
            price_fetcher=FakePrices(),
            feed_fetcher=FakeFeeds(),
        )


# ---------- pela API + WebSocket ----------


@pytest.fixture
def client() -> TestClient:
    app = create_app(
        _settings(),
        price_fetcher=FakePrices(),
        feed_fetcher=FakeFeeds(),
        clock=SimulatedClock(NOW),
        start_scheduler=False,
    )
    with TestClient(app) as c:
        yield c


def test_api_ciclo_via_ws(client: TestClient) -> None:
    with client.websocket_connect("/ws") as ws:
        resp = client.post("/api/cycle", json={"ticker": "PETR4.SA"})
        assert resp.status_code == 202
        cycle_id = resp.json()["cycle_id"]
        recebidos = []
        while True:
            data = ws.receive_json()
            event_adapter.validate_python(data)
            recebidos.append(data)
            if data["type"] == "cycle_finished":
                break
    assert all(e["cycle_id"] == cycle_id for e in recebidos)

    pf = client.get("/api/portfolio").json()
    assert pf["cash"] == 100_000 and len(pf["pending_orders"]) == 1
    orders = client.get("/api/orders", params={"ticker": "PETR4.SA"}).json()["orders"]
    assert orders[0]["status"] == "pending"
    assert len(client.get("/api/events").json()["events"]) == len(recebidos)


def test_api_ticker_fora_da_lista(client: TestClient) -> None:
    assert client.post("/api/cycle", json={"ticker": "XYZ"}).status_code == 422


def test_assert_no_future_usa_disponibilidade_do_candle() -> None:
    # candle diário de 18/11 abre 00:00, mas só fica completo às 18:00
    state = {"interval": "1d", "indicators": {"last_candle": {"time": "2026-11-18T00:00:00-03:00"}}}
    with pytest.raises(LookAheadError):
        assert_no_future(state, NOW)  # NOW = 18/11 14:00
