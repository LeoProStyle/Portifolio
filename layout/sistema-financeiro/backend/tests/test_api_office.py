"""API do escritório: prédio, salas, robôs e pausas."""

import asyncio
from collections.abc import Iterator
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.clock import TZ_BRASILIA, SimulatedClock
from app.config import Settings
from app.engine.step import robot_step
from app.main import create_app
from tests.fakes import FakeFeeds, FakePrices

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)


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


def test_building_soma_salas(client: TestClient) -> None:
    body = client.get("/api/building").json()
    assert [r["id"] for r in body["rooms"]] == ["acoes", "minis", "cripto"]
    assert body["rooms"][1]["equity"] == pytest.approx(4 * 100_000)  # 3 + QUASAR
    assert body["equity"] == pytest.approx(sum(r["equity_brl"] for r in body["rooms"]))
    assert body["rooms"][0]["equity"] == pytest.approx(8 * 100_000)  # 6 + ÓRBITA e COMETA
    assert body["rooms"][0]["paused"] is False


def test_robots_da_sala_com_pnl(client: TestClient) -> None:
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    robot = rt.office.robot("rigel")
    asyncio.run(robot_step(rt.engine_ctx, robot, AT))
    rows = client.get("/api/rooms/acoes/robots").json()
    assert {"atlas", "orion", "vega", "rigel", "nova", "mesa-ia"} <= {r["id"] for r in rows}
    rigel = next(r for r in rows if r["id"] == "rigel")
    assert rigel["run_id"].startswith("rigel-")
    assert rigel["strategy"] == "atr_trend" and rigel["ticker"] == "PETR4.SA"
    assert rigel["last_signal"] in {"COMPRA", "ESPERA"}
    assert rigel["last_decision_ts"] is not None
    assert rigel["pnl"] == pytest.approx(rigel["equity"] - rigel["initial_cash"])
    atlas = next(r for r in rows if r["id"] == "atlas")
    assert atlas["last_signal"] is None  # ainda não decidiu

    detail = client.get("/api/robots/rigel").json()
    assert detail["id"] == "rigel" and isinstance(detail["orders"], list)
    assert len(detail["equity_curve"]) == 1


def test_pause_resume_sala(client: TestClient) -> None:
    assert client.post("/api/rooms/acoes/pause").status_code == 200
    room = client.get("/api/building").json()["rooms"][0]
    assert room["paused"] is True and room["reason"]
    assert client.post("/api/rooms/acoes/resume").status_code == 200
    assert client.get("/api/building").json()["rooms"][0]["paused"] is False


def test_pause_robo_bloqueia_so_compras_novas(client: TestClient) -> None:
    assert client.post("/api/robots/rigel/pause").status_code == 200
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    res = asyncio.run(robot_step(rt.engine_ctx, rt.office.robot("rigel"), AT))
    assert res.order_id is None and res.blocked_reason and "robô pausado" in res.blocked_reason
    row = next(r for r in client.get("/api/rooms/acoes/robots").json() if r["id"] == "rigel")
    assert row["paused"] is True
    client.post("/api/robots/rigel/resume")
    row = next(r for r in client.get("/api/rooms/acoes/robots").json() if r["id"] == "rigel")
    assert row["paused"] is False


def test_robo_inexistente_404(client: TestClient) -> None:
    assert client.get("/api/robots/nao-existe").status_code == 404
    assert client.post("/api/robots/nao-existe/pause").status_code == 404
    assert client.get("/api/rooms/opcoes-binarias/robots").status_code == 404
    assert client.post("/api/rooms/opcoes-binarias/pause").status_code == 404


def test_robo_tem_pnl_fechado_aberto_e_minicurva(client: TestClient) -> None:
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    asyncio.run(robot_step(rt.engine_ctx, rt.office.robot("rigel"), AT))
    rows = client.get("/api/rooms/acoes/robots").json()
    for r in rows:
        assert r["realized_pnl"] + r["unrealized_pnl"] == pytest.approx(r["pnl"], abs=0.02)
        assert isinstance(r["look"], dict)
        assert len(r["spark"]) <= 30
    rigel = next(r for r in rows if r["id"] == "rigel")
    assert rigel["spark"] and rigel["spark"][-1] == pytest.approx(rigel["equity"])


def test_curva_da_sala_soma_os_robos(client: TestClient) -> None:
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    asyncio.run(robot_step(rt.engine_ctx, rt.office.robot("rigel"), AT))
    curve = client.get("/api/rooms/acoes/equity").json()
    assert curve and set(curve[0]) == {"time", "value"}
    room = client.get("/api/building").json()["rooms"][0]
    assert curve[-1]["value"] == pytest.approx(room["equity"])
    assert client.get("/api/rooms/xyz/equity").status_code == 404


def test_robo_de_minis_informa_o_instrumento_e_o_proxy(client: TestClient) -> None:
    rows = client.get("/api/rooms/minis/robots").json()
    assert {r["id"] for r in rows} == {"sirius", "altair", "polaris", "quasar"}
    sirius = next(r for r in rows if r["id"] == "sirius")
    assert sirius["instrument"] == {
        "symbol": "WIN",
        "name": "Mini-índice (proxy ^BVSP)",
        "proxy": "^BVSP",
        "scale": 1.0,
        "multiplier": 0.2,
    }
    acoes = client.get("/api/rooms/acoes/robots").json()
    assert all(r["instrument"] is None for r in acoes)


def test_predio_soma_cripto_em_reais_pela_cotacao_do_instante(client: TestClient) -> None:
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    fx = rt.prices.get_candles("USDBRL=X", until=AT, lookback_days=10)
    rate = float(fx["close"].iloc[-1])
    body = client.get("/api/building").json()
    cripto = next(r for r in body["rooms"] if r["id"] == "cripto")
    assert cripto["currency"] == "USD" and cripto["equity"] == pytest.approx(6 * 20_000)
    assert cripto["fx_rate"] == pytest.approx(rate)
    assert cripto["equity_brl"] == pytest.approx(6 * 20_000 * rate)
    acoes = next(r for r in body["rooms"] if r["id"] == "acoes")
    assert acoes["currency"] == "BRL" and acoes["equity_brl"] == pytest.approx(acoes["equity"])
    assert body["equity"] == pytest.approx(sum(r["equity_brl"] for r in body["rooms"]))
    assert body["fx_missing"] is False
    robots = client.get("/api/rooms/cripto/robots").json()
    assert {r["currency"] for r in robots} == {"USD"}


def test_sem_cotacao_a_sala_em_dolar_fica_fora_e_o_predio_avisa(client, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.office import fx as fx_mod

    monkeypatch.setattr(fx_mod, "usd_brl", lambda prices, at: None)
    body = client.get("/api/building").json()
    cripto = next(r for r in body["rooms"] if r["id"] == "cripto")
    assert cripto["equity_brl"] is None and body["fx_missing"] is True
    assert body["equity"] == pytest.approx(12 * 100_000)  # só as salas em reais


def test_robo_mostra_dias_ao_vivo_e_comprar_e_segurar(client: TestClient) -> None:
    rows = client.get("/api/rooms/acoes/robots").json()  # abre as contas em AT
    atlas = next(r for r in rows if r["id"] == "atlas")
    assert atlas["live"]["days"] == 0 and atlas["live"]["hold_return"] is None  # conta nova
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    rt.clock.set(AT + timedelta(days=2))
    # o cache só grava candle já fechado no relógio de parede: segue o relógio simulado
    rt.prices._wall = lambda: rt.clock.now().timestamp()
    # quem atualiza o cache é o motor dos robôs; a lista só lê o cache
    rt.prices.get_candles("PETR4.SA", until=rt.clock.now(), lookback_days=10)
    atlas = next(r for r in client.get("/api/rooms/acoes/robots").json() if r["id"] == "atlas")
    live = atlas["live"]
    assert live["days"] == 2 and live["remaining_days"] == 88 and live["target_days"] == 90
    assert live["hold_return"] is not None  # candles de 19 e 20/11 depois do início
    assert live["robot_return"] == pytest.approx(atlas["pnl_pct"])
    assert live["beats_hold"] in (True, False)


def test_mesa_ia_nao_compara_com_um_ativo_so(client: TestClient) -> None:
    client.get("/api/rooms/acoes/robots")
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    rt.clock.set(AT + timedelta(days=2))
    rt.prices._wall = lambda: rt.clock.now().timestamp()
    rt.prices.get_candles("PETR4.SA", until=rt.clock.now(), lookback_days=10)  # cache em dia
    rows = client.get("/api/rooms/acoes/robots").json()
    mesa = next(r for r in rows if r["id"] == "mesa-ia")
    # a Mesa IA opera vários ativos: comparar com PETR4 sozinha enganaria
    assert mesa["live"]["hold_return"] is None and mesa["live"]["beats_hold"] is None


def test_rastreador_mostra_lista_posicoes_e_cesta_igual(client: TestClient) -> None:
    rows = client.get("/api/rooms/acoes/robots").json()
    orbita = next(r for r in rows if r["id"] == "orbita")
    assert len(orbita["universe"]) == 20 and orbita["positions"] == []
    rt = client.app.state.runtime  # type: ignore[attr-defined]
    rt.clock.set(AT + timedelta(days=2))
    rt.prices._wall = lambda: rt.clock.now().timestamp()
    asyncio.run(robot_step(rt.engine_ctx, rt.office.robot("orbita"), rt.clock.now()))  # cache
    orbita = next(r for r in client.get("/api/rooms/acoes/robots").json() if r["id"] == "orbita")
    # benchmark do rastreador = cesta igual (média do comprar e segurar de cada ativo)
    assert orbita["live"]["hold_return"] is not None
