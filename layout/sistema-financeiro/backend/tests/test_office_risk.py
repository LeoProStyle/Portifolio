"""Risco do escritório (Gerente Geral): perda do dia, pausa manual e exposição somada."""

from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy import insert

from app.clock import TZ_BRASILIA
from app.db.models import equity_history, make_engine
from app.engine.office_risk import OfficeRisk
from app.office.accounts import AccountRegistry
from app.office.config import OfficeConfig

AT = datetime(2026, 11, 18, 18, 30, tzinfo=TZ_BRASILIA)
OFFICE = OfficeConfig.model_validate(
    {
        "rooms": [{"id": "acoes", "name": "Ações", "max_instrument_exposure": 0.40}],
        "robots": [
            {
                "id": "aa",
                "name": "A",
                "room": "acoes",
                "ticker": "PETR4.SA",
                "strategy": {"kind": "sma_cross"},
            },
            {
                "id": "bb",
                "name": "B",
                "room": "acoes",
                "ticker": "PETR4.SA",
                "strategy": {"kind": "donchian"},
            },
        ],
    }
)


def _setup():
    engine = make_engine("sqlite://")
    accounts = AccountRegistry(engine, fee_pct=0.0, slippage_pct=0.0)
    return engine, accounts, OfficeRisk(engine, OFFICE, accounts)


def _equity(engine, run_id: str, at: datetime, value: float) -> None:
    with engine.begin() as conn:
        conn.execute(
            insert(equity_history).values(
                account_id=run_id, ts=int(at.timestamp()), cash=value, equity=value
            )
        )


def test_perda_da_sala_bloqueia_ate_meia_noite() -> None:
    engine, accounts, risk = _setup()
    runs = [accounts.live_run(r, AT) for r in OFFICE.robots]
    for r in runs:
        _equity(engine, r, AT - timedelta(days=1), 100_000)
        _equity(engine, r, AT, 96_000)  # -4% no dia
    ok, why = risk.allows_new_orders("acoes", "PETR4.SA", AT, 0)
    assert not ok and "perda do dia" in why
    tomorrow = AT + timedelta(days=1)
    assert risk.allows_new_orders("acoes", "PETR4.SA", tomorrow, 0)[0]


def test_pausa_manual_persiste_ate_resume() -> None:
    _, _, risk = _setup()
    risk.pause("acoes", "teste manual")
    assert not risk.allows_new_orders("acoes", "PETR4.SA", AT, 0)[0]
    assert not risk.allows_new_orders("acoes", "PETR4.SA", AT + timedelta(days=3), 0)[0]
    risk.resume("acoes")
    assert risk.allows_new_orders("acoes", "PETR4.SA", AT, 0)[0]


def _buy(accounts, run_id: str, qty: int, price: float) -> None:
    broker = accounts.broker_for(run_id)
    broker.submit_order("PETR4.SA", "COMPRA", qty, stop=None, at=AT - timedelta(days=2))
    idx = pd.DatetimeIndex([pd.Timestamp("2026-11-17", tz=TZ_BRASILIA)])
    broker.process_candles(
        "PETR4.SA",
        pd.DataFrame(
            {"open": [price], "high": [price], "low": [price], "close": [price], "volume": [1e6]},
            index=idx,
        ),
    )


def test_exposicao_somada_de_dois_robos_bloqueia_e_nao_zera_posicoes() -> None:
    _, accounts, risk = _setup()
    a, b = (accounts.live_run(r, AT) for r in OFFICE.robots)
    _buy(accounts, a, 500, 40.0)  # 20 mil
    _buy(accounts, b, 500, 40.0)  # 20 mil  → 40 mil no PETR4; sala ~200 mil → teto 80 mil
    assert not risk.allows_new_orders("acoes", "PETR4.SA", AT, 50_000)[0]
    assert risk.allows_new_orders("acoes", "PETR4.SA", AT, 30_000)[0]
    assert accounts.broker_for(a).position_qty("PETR4.SA") == 500  # nada foi zerado
