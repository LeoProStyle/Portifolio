"""API de backtest: rodar, listar, detalhar, erros e isolamento do P&L do prédio."""

import asyncio
from collections.abc import Iterator
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.main import create_app
from tests.fakes import FakeFeeds, FakePrices

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)
PERIOD = {"start": "2026-07-01", "end": "2026-11-18"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    settings = Settings(_env_file=None, database_url="sqlite://")
    app = create_app(
        settings,
        price_fetcher=FakePrices("alta"),
        feed_fetcher=FakeFeeds(),
        clock=SimulatedClock(AT),
        start_scheduler=False,
    )
    with TestClient(app) as c:
        yield c


def test_roda_lista_e_detalha_sem_mexer_no_predio(client: TestClient) -> None:
    before = client.get("/api/building").json()["equity"]
    res = client.post("/api/robots/rigel/backtest", json=PERIOD)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["robot_id"] == "rigel" and body["steps"] > 90
    assert {c["name"] for c in body["verdict"]["checks"]} >= {"periodo", "amostra"}
    assert client.get("/api/building").json()["equity"] == pytest.approx(before)

    listed = client.get("/api/robots/rigel/backtests").json()
    assert [b["run_id"] for b in listed] == [body["run_id"]]
    assert "benchmark_curve" not in listed[0]

    detail = client.get(f"/api/backtests/{body['run_id']}").json()
    assert len(detail["equity_curve"]) == body["steps"]
    assert isinstance(detail["fills"], list) and detail["benchmark_curve"]


def test_periodo_padrao_sao_2_anos(client: TestClient) -> None:
    body = client.post("/api/robots/rigel/backtest", json={}).json()
    assert body["period_days"] >= 730
    assert body["end"].startswith("2026-11-18")


def test_erros(client: TestClient) -> None:
    assert client.post("/api/robots/mesa-ia/backtest", json=PERIOD).status_code == 400
    assert "Mesa IA" in client.post("/api/robots/mesa-ia/backtest", json=PERIOD).json()["detail"]
    futuro = client.post("/api/robots/rigel/backtest", json={"end": "2026-12-31"})
    assert futuro.status_code == 400
    assert client.post("/api/robots/nao-existe/backtest", json=PERIOD).status_code == 404
    assert client.get("/api/backtests/nao-existe").status_code == 404


def test_um_backtest_por_vez(client: TestClient) -> None:
    lock = client.app.state.backtest_lock  # type: ignore[attr-defined]
    asyncio.run(lock.acquire())
    try:
        assert client.post("/api/robots/rigel/backtest", json=PERIOD).status_code == 409
    finally:
        lock.release()
