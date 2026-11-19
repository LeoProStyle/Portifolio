"""Testes básicos da API (health e configuração de segurança)."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.clock import SimulatedClock
from app.config import Settings
from app.main import create_app
from tests.fakes import NOW, FakeFeeds, FakePrices


def _client() -> TestClient:
    settings = Settings(_env_file=None, database_url="sqlite://")
    app = create_app(
        settings,
        price_fetcher=FakePrices(),
        feed_fetcher=FakeFeeds(),
        clock=SimulatedClock(NOW),
        start_scheduler=False,
    )
    return TestClient(app)


def test_health() -> None:
    with _client() as client:
        body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["mode"] == "paper"
    assert body["live_trading_enabled"] is False
    assert body["llm_provider"] == "mock"
    assert body["cycle_running"] is False


def test_rota_demo_da_fase_1_foi_removida() -> None:
    with _client() as client:
        assert client.post("/api/demo/cycle", json={"ticker": "PETR4.SA"}).status_code == 404


def test_live_trading_true_e_recusado() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, live_trading_enabled=True)


def test_portfolio_inicial() -> None:
    with _client() as client:
        pf = client.get("/api/portfolio").json()
    assert pf["cash"] == 100_000
    assert pf["equity"] == 100_000
    assert pf["positions"] == [] and pf["pending_orders"] == []


# ---------- SEC-001: Host e Origin ----------


def test_host_desconhecido_e_recusado() -> None:
    with _client() as client:
        assert client.get("/health", headers={"host": "evil.com"}).status_code == 400


def test_ws_origin_desconhecida_e_recusada() -> None:
    from starlette.websockets import WebSocketDisconnect

    with _client() as client:
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect("/ws", headers={"origin": "http://evil.com"}):
                pass
        assert exc.value.code == 1008


def test_ws_origin_permitida_e_sem_origin_sao_aceitas() -> None:
    with _client() as client:
        with client.websocket_connect("/ws", headers={"origin": "http://localhost:5173"}):
            pass
        with client.websocket_connect("/ws"):
            pass


def _app_with_dist(dist: str) -> TestClient:
    settings = Settings(_env_file=None, database_url="sqlite://", frontend_dist=dist)
    app = create_app(
        settings,
        price_fetcher=FakePrices("alta"),
        feed_fetcher=FakeFeeds(),
        clock=SimulatedClock(NOW),
        start_scheduler=False,
    )
    return TestClient(app)


def test_backend_serve_a_tela_compilada(tmp_path) -> None:  # type: ignore[no-untyped-def]
    (tmp_path / "index.html").write_text("<!doctype html><title>Escritório</title>", "utf-8")
    with _app_with_dist(str(tmp_path)) as c:
        page = c.get("/")
        assert page.status_code == 200 and "Escritório" in page.text
        assert c.get("/health").json()["mode"] == "paper"  # API continua respondendo
        assert c.get("/api/building").status_code == 200


def test_sem_tela_compilada_so_a_api(tmp_path) -> None:  # type: ignore[no-untyped-def]
    with _app_with_dist(str(tmp_path / "nao-existe")) as c:
        assert c.get("/").status_code == 404
        assert c.get("/health").status_code == 200


def test_origem_da_tela_servida_pelo_backend_e_aceita() -> None:
    s = Settings(_env_file=None)
    assert "http://localhost:8000" in s.cors_origins
    assert "http://127.0.0.1:8000" in s.cors_origins


def test_rota_de_api_inexistente_e_404_mesmo_com_a_tela(tmp_path) -> None:  # type: ignore[no-untyped-def]
    (tmp_path / "index.html").write_text("<!doctype html>", "utf-8")
    with _app_with_dist(str(tmp_path)) as c:
        assert c.post("/api/nao-existe", json={}).status_code == 404
        assert c.get("/api/nao-existe").status_code == 404
