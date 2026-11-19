"""Contas por robô: separação, versão da configuração e adoção da carteira antiga."""

from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy import insert

from app.clock import TZ_BRASILIA
from app.db.models import make_engine, runs
from app.office.accounts import AccountRegistry
from app.office.config import RobotConfig

NOW = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)


def _robot(rid: str = "atlas", **kw: object) -> RobotConfig:
    base = {
        "id": rid,
        "name": rid.upper(),
        "room": "acoes",
        "ticker": "PETR4.SA",
        "strategy": {"kind": "sma_cross"},
    }
    base.update(kw)
    return RobotConfig.model_validate(base)


def _registry():
    engine = make_engine("sqlite://")
    return engine, AccountRegistry(engine, fee_pct=0.0, slippage_pct=0.0)


def _candles(day: str, price: float) -> pd.DataFrame:
    idx = pd.DatetimeIndex([pd.Timestamp(day, tz=TZ_BRASILIA)])
    return pd.DataFrame(
        {"open": [price], "high": [price], "low": [price], "close": [price], "volume": [1e6]},
        index=idx,
    )


def test_dois_robos_mesmo_ticker_contas_separadas() -> None:
    _, reg = _registry()
    a = reg.broker_for(reg.live_run(_robot("atlas"), NOW))
    b = reg.broker_for(reg.live_run(_robot("rigel"), NOW))
    a.submit_order("PETR4.SA", "COMPRA", 10, stop=None, at=NOW)
    a.process_candles("PETR4.SA", _candles("2026-11-19", 40.0))
    assert a.position_qty("PETR4.SA") == 10
    assert b.position_qty("PETR4.SA") == 0
    assert b.portfolio({}).cash == 100_000
    assert b.list_orders() == []


def test_mesmo_hash_reaproveita_run() -> None:
    _, reg = _registry()
    r1 = reg.live_run(_robot(), NOW)
    r2 = reg.live_run(_robot(name="Renomeado"), NOW + timedelta(days=1))
    assert r1 == r2


def test_hash_novo_abre_run_novo_e_fecha_antigo() -> None:
    _, reg = _registry()
    r1 = reg.live_run(_robot(), NOW)
    r2 = reg.live_run(
        _robot(strategy={"kind": "sma_cross", "params": {"fast": 5}}), NOW + timedelta(days=1)
    )
    assert r1 != r2
    assert reg.run_info(r1)["ended_ts"] is not None
    assert reg.run_info(r2)["ended_ts"] is None
    assert reg.broker_for(r2).portfolio({}).cash == 100_000


def test_execucao_legacy_e_adotada_pelo_robo() -> None:
    engine, reg = _registry()
    with engine.begin() as conn:
        conn.execute(
            insert(runs).values(
                id="legacy-mesa-ia",
                robot_id="mesa-ia",
                mode="live",
                config_hash="legacy",
                initial_cash=100000,
                started_ts=1,
                ended_ts=None,
            )
        )
    run = reg.live_run(_robot("mesa-ia", strategy={"kind": "mesa_ia"}), NOW)
    assert run == "legacy-mesa-ia"
    assert reg.run_info(run)["config_hash"] != "legacy"
