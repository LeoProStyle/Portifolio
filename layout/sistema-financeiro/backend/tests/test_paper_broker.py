"""PaperBroker: próximo candle, taxas, slippage, stop e persistência (seção 15)."""

from datetime import datetime

import pandas as pd
import pytest

from app.broker.base import Broker, create_broker
from app.broker.paper import PaperBroker
from app.clock import TZ_BRASILIA
from app.config import Settings
from app.db.models import make_engine

FEE = 0.001  # 0,1% para facilitar as contas
SLIP = 0.01  # 1%


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ_BRASILIA)


def _candles(rows: list[tuple[str, float, float, float, float]]) -> pd.DataFrame:
    idx = pd.DatetimeIndex([pd.Timestamp(d, tz=TZ_BRASILIA) for d, *_ in rows], name="time")
    return pd.DataFrame(
        {
            "open": [r[1] for r in rows],
            "high": [r[2] for r in rows],
            "low": [r[3] for r in rows],
            "close": [r[4] for r in rows],
            "volume": 1000.0,
        },
        index=idx,
    )


@pytest.fixture
def engine():
    return make_engine("sqlite://")


@pytest.fixture
def broker(engine) -> PaperBroker:
    return PaperBroker(engine, initial_cash=10_000, fee_pct=FEE, slippage_pct=SLIP)


def test_compra_executa_na_abertura_do_proximo_candle(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=90, at=_dt("2026-11-17T14:00:00"))
    df = _candles(
        [
            ("2026-11-17", 99, 101, 98, 100),  # candle do sinal: abriu antes da ordem
            ("2026-11-18", 100, 102, 99, 101),  # próximo candle: executa aqui
        ]
    )
    fills = broker.process_candles("PETR4.SA", df)

    assert len(fills) == 1
    f = fills[0]
    assert f.price == pytest.approx(100 * (1 + SLIP))  # abertura + slippage
    assert f.fee == pytest.approx(100 * (1 + SLIP) * 10 * FEE)
    assert f.ts == pd.Timestamp("2026-11-18", tz=TZ_BRASILIA)

    snap = broker.portfolio({"PETR4.SA": 101})
    assert snap.cash == pytest.approx(10_000 - f.price * 10 - f.fee)
    assert snap.positions[0].qty == 10
    assert snap.positions[0].avg_price == pytest.approx(f.price)
    assert snap.equity == pytest.approx(snap.cash + 10 * 101)


def test_ordem_nao_executa_sem_candle_posterior(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=90, at=_dt("2026-11-18T14:00:00"))
    fills = broker.process_candles("PETR4.SA", _candles([("2026-11-18", 100, 102, 99, 101)]))
    assert fills == []
    assert [o.status for o in broker.list_orders()] == ["pending"]


def test_venda_aplica_slippage_contra(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=None, at=_dt("2026-11-16T14:00:00"))
    broker.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 100, 100, 100)]))
    broker.submit_order("PETR4.SA", "VENDA", 10, stop=None, at=_dt("2026-11-17T14:00:00"))
    fills = broker.process_candles("PETR4.SA", _candles([("2026-11-18", 110, 111, 109, 110)]))

    assert fills[0].price == pytest.approx(110 * (1 - SLIP))
    snap = broker.portfolio({})
    assert snap.positions == []
    compra = 100 * (1 + SLIP) * 10
    venda = 110 * (1 - SLIP) * 10
    assert snap.cash == pytest.approx(10_000 - compra - compra * FEE + venda - venda * FEE)


def test_stop_executa_no_preco_do_stop(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"))
    df = _candles(
        [
            ("2026-11-17", 100, 101, 99, 100),  # compra; mínima 99 > stop
            ("2026-11-18", 98, 99, 94, 96),  # mínima 94 <= stop 95 -> sai a 95
        ]
    )
    fills = broker.process_candles("PETR4.SA", df)

    assert [f.side for f in fills] == ["COMPRA", "VENDA"]
    assert fills[1].price == pytest.approx(95 * (1 - SLIP))
    assert broker.list_orders()[0].reason == "stop"  # mais recente primeiro


def test_stop_com_gap_sai_na_abertura(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"))
    df = _candles(
        [
            ("2026-11-17", 100, 101, 99, 100),
            ("2026-11-18", 90, 92, 88, 91),  # abriu abaixo do stop
        ]
    )
    fills = broker.process_candles("PETR4.SA", df)
    assert fills[1].price == pytest.approx(90 * (1 - SLIP))


def test_candle_ja_processado_nao_executa_duas_vezes(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"))
    df = _candles([("2026-11-17", 100, 101, 99, 100), ("2026-11-18", 98, 99, 94, 96)])
    broker.process_candles("PETR4.SA", df)
    assert broker.process_candles("PETR4.SA", df) == []


def test_caixa_insuficiente_reduz_quantidade(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "COMPRA", 1000, stop=None, at=_dt("2026-11-16T14:00:00"))
    fills = broker.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 100, 100, 100)]))
    preco = 100 * (1 + SLIP)
    esperado = int(10_000 // (preco * (1 + FEE)))
    assert fills[0].qty == esperado
    assert broker.portfolio({}).cash >= 0


def test_venda_sem_posicao_e_rejeitada(broker: PaperBroker) -> None:
    broker.submit_order("PETR4.SA", "VENDA", 10, stop=None, at=_dt("2026-11-16T14:00:00"))
    fills = broker.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 100, 100, 100)]))
    assert fills == []
    assert broker.list_orders()[0].status == "rejected"


def test_quantidade_invalida_e_recusada(broker: PaperBroker) -> None:
    with pytest.raises(ValueError):
        broker.submit_order("PETR4.SA", "COMPRA", 0, stop=None, at=_dt("2026-11-16T14:00:00"))


def test_estado_persiste_no_banco(engine) -> None:
    b1 = PaperBroker(engine, initial_cash=10_000, fee_pct=FEE, slippage_pct=SLIP)
    b1.submit_order("PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"))
    b1.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 101, 99, 100)]))

    b2 = PaperBroker(engine, initial_cash=10_000, fee_pct=FEE, slippage_pct=SLIP)
    snap1, snap2 = b1.portfolio({"PETR4.SA": 100}), b2.portfolio({"PETR4.SA": 100})
    assert snap2.cash == pytest.approx(snap1.cash)
    assert snap2.positions[0].qty == 10
    assert snap2.positions[0].stop == 95
    # o cursor também persiste: o candle não é reprocessado
    assert b2.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 101, 99, 100)])) == []


def test_perda_do_dia(broker: PaperBroker) -> None:
    broker.record_equity(_dt("2026-11-17T18:00:00"), {})  # 10.000 no fim de ontem
    broker.submit_order("PETR4.SA", "COMPRA", 50, stop=None, at=_dt("2026-11-17T14:00:00"))
    broker.process_candles("PETR4.SA", _candles([("2026-11-18", 100, 100, 100, 100)]))
    # posição de 50 ações cai para 90
    pnl = broker.daily_pnl_pct(_dt("2026-11-18T15:00:00"), {"PETR4.SA": 90})
    equity = broker.portfolio({"PETR4.SA": 90}).equity
    assert pnl == pytest.approx(equity / 10_000 - 1)
    assert pnl < 0


def test_tickers_ativos(broker: PaperBroker) -> None:
    broker.submit_order("VALE3.SA", "COMPRA", 1, stop=None, at=_dt("2026-11-16T14:00:00"))
    assert broker.active_tickers() == {"VALE3.SA"}


# ---------- segurança (regra nº 1) ----------


def test_nenhum_broker_real_existe_nem_e_instanciado(engine) -> None:
    settings = Settings(_env_file=None, database_url="sqlite://")
    assert settings.live_trading_enabled is False
    broker = create_broker(settings, engine)
    assert type(broker) is PaperBroker
    # a única implementação da interface é a simulada
    assert Broker.__subclasses__() == [PaperBroker]


# ---------- alvo (take-profit), adaptado do Trader skill v2 ----------


def test_alvo_executa_no_preco_do_alvo(broker: PaperBroker) -> None:
    broker.submit_order(
        "PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"), target=110
    )
    df = _candles([("2026-11-17", 100, 101, 99, 100), ("2026-11-18", 105, 112, 104, 111)])
    fills = broker.process_candles("PETR4.SA", df)
    assert [f.reason for f in fills] == ["decisao", "alvo"]
    assert fills[1].price == pytest.approx(110 * (1 - SLIP))
    assert broker.position_qty("PETR4.SA") == 0


def test_stop_e_alvo_no_mesmo_candle_conta_o_stop(broker: PaperBroker) -> None:
    broker.submit_order(
        "PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"), target=110
    )
    df = _candles([("2026-11-17", 100, 101, 99, 100), ("2026-11-18", 100, 112, 94, 100)])
    fills = broker.process_candles("PETR4.SA", df)
    assert fills[1].reason == "stop"


def test_alvo_persiste_no_banco(engine) -> None:
    b1 = PaperBroker(engine, initial_cash=10_000, fee_pct=FEE, slippage_pct=SLIP)
    b1.submit_order("PETR4.SA", "COMPRA", 10, stop=95, at=_dt("2026-11-16T14:00:00"), target=110)
    b1.process_candles("PETR4.SA", _candles([("2026-11-17", 100, 101, 99, 100)]))
    b2 = PaperBroker(engine, initial_cash=10_000, fee_pct=FEE, slippage_pct=SLIP)
    fills = b2.process_candles("PETR4.SA", _candles([("2026-11-18", 105, 111, 104, 110)]))
    assert fills and fills[0].reason == "alvo"


def test_quantidade_fracionaria_arredonda_para_baixo_no_passo() -> None:
    engine = make_engine("sqlite://")
    b = PaperBroker(
        engine, initial_cash=1000, fee_pct=0.001, slippage_pct=0.0, account_id="c1", qty_step=0.0001
    )
    b.submit_order("BTC-USD", "COMPRA", 1, 25000, at=_dt("2026-11-16T21:30"))
    fills = b.process_candles(
        "BTC-USD", _candles([("2026-11-17T21:00", 30000, 30500, 29800, 30200)])
    )
    # 1000 / (30000 × 1,001) = 0,03330… → 0,0333 (passo 0,0001), caixa nunca negativo
    assert fills[0].qty == pytest.approx(0.0333)
    assert b.portfolio({}).cash >= 0
    again = PaperBroker(
        engine, initial_cash=1000, fee_pct=0.001, slippage_pct=0.0, account_id="c1", qty_step=0.0001
    )
    assert again.position_qty("BTC-USD") == pytest.approx(0.0333)
