"""FuturesBroker (minicontratos): resultado em pontos × multiplicador, margem e vendido.

Contas à mão com WIN: R$ 0,20/ponto, custo R$ 0,50/contrato, margem R$ 4.000,
slippage de 5 pontos sempre contra.
"""

from datetime import datetime

import pandas as pd
import pytest

from app.broker.futures import ContractSpec, FuturesBroker
from app.clock import TZ_BRASILIA
from app.db.models import make_engine

WIN = ContractSpec(
    multiplier=0.2, fee_per_contract=0.5, margin_per_contract=4000, slippage_points=5
)
T = "WIN"


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ_BRASILIA)


def _c(rows: list[tuple[str, float, float, float, float]]) -> pd.DataFrame:
    idx = pd.DatetimeIndex([pd.Timestamp(d, tz=TZ_BRASILIA) for d, *_ in rows], name="time")
    return pd.DataFrame(
        {
            "open": [r[1] for r in rows],
            "high": [r[2] for r in rows],
            "low": [r[3] for r in rows],
            "close": [r[4] for r in rows],
            "volume": 0.0,
        },
        index=idx,
    )


@pytest.fixture
def engine():  # type: ignore[no-untyped-def]
    return make_engine("sqlite://")


def _broker(engine, cash: float = 100_000) -> FuturesBroker:  # type: ignore[no-untyped-def]
    return FuturesBroker(engine, initial_cash=cash, spec=WIN, account_id="w1")


def test_compra_e_venda_resultado_em_pontos(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "COMPRA", 2, 119000, at=_dt("2026-11-16T18:30"), target=122000)
    fills = b.process_candles(T, _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    assert fills[0].price == 120005 and fills[0].fee == 1.0
    assert b.position_qty(T) == 2
    # caixa não paga o "valor" do contrato: só o custo
    snap = b.portfolio({T: 121005})
    assert snap.cash == pytest.approx(99_999)
    assert snap.equity == pytest.approx(99_999 + (121005 - 120005) * 2 * 0.2)

    b.submit_order(T, "VENDA", 2, None, at=_dt("2026-11-17T18:30"))
    fills = b.process_candles(T, _c([("2026-11-18", 120505, 120700, 120400, 120600)]))
    assert fills[0].price == 120500
    # (120500 − 120005) × 2 × 0,20 = 198; custos 1 + 1
    assert b.position_qty(T) == 0
    assert b.portfolio({}).equity == pytest.approx(100_000 - 1 + 198 - 1)


def test_venda_a_descoberto_ganha_na_queda(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "VENDA", 1, 121000, at=_dt("2026-11-16T18:30"), target=117000)
    b.process_candles(T, _c([("2026-11-17", 120000, 120300, 119500, 119600)]))
    assert b.position_qty(T) == -1
    assert b.portfolio({T: 119000}).equity == pytest.approx(100_000 - 0.5 + (119995 - 119000) * 0.2)
    b.submit_order(T, "COMPRA", 1, None, at=_dt("2026-11-17T18:30"))
    fills = b.process_candles(T, _c([("2026-11-18", 119000, 119200, 118800, 119100)]))
    assert fills[0].side == "COMPRA" and fills[0].price == 119005
    assert b.position_qty(T) == 0
    assert b.portfolio({}).equity == pytest.approx(100_000 - 0.5 + (119995 - 119005) * 0.2 - 0.5)


def test_stop_do_vendido_e_acima(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "VENDA", 1, 121000, at=_dt("2026-11-16T18:30"), target=117000)
    b.process_candles(T, _c([("2026-11-17", 120000, 120500, 119500, 120200)]))
    fills = b.process_candles(T, _c([("2026-11-18", 120200, 121100, 120100, 121050)]))
    assert len(fills) == 1 and fills[0].reason == "stop" and fills[0].side == "COMPRA"
    assert fills[0].price == 121005  # stop + 5 pontos contra
    assert b.position_qty(T) == 0
    assert b.portfolio({}).equity == pytest.approx(100_000 - 0.5 + (119995 - 121005) * 0.2 - 0.5)


def test_stop_do_vendido_com_gap_sai_na_abertura(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "VENDA", 1, 121000, at=_dt("2026-11-16T18:30"))
    b.process_candles(T, _c([("2026-11-17", 120000, 120500, 119500, 120200)]))
    fills = b.process_candles(T, _c([("2026-11-18", 121500, 121800, 121400, 121600)]))
    assert fills[0].price == 121505


def test_alvo_do_vendido_e_abaixo(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "VENDA", 1, 121000, at=_dt("2026-11-16T18:30"), target=118000)
    b.process_candles(T, _c([("2026-11-17", 120000, 120500, 119500, 120200)]))
    fills = b.process_candles(T, _c([("2026-11-18", 119000, 119200, 117900, 118100)]))
    assert fills[0].reason == "alvo" and fills[0].price == 118005


def test_margem_insuficiente_reduz_a_quantidade(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine, cash=10_000)  # cabe 2 contratos de R$ 4.000
    b.submit_order(T, "COMPRA", 5, 119000, at=_dt("2026-11-16T18:30"))
    fills = b.process_candles(T, _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    assert fills[0].qty == 2
    order = b.list_orders()[0]
    assert "margem" in order.note
    assert b.exposure(T) == pytest.approx(2 * 4000)


def test_venda_maior_que_a_posicao_so_zera(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "COMPRA", 2, 119000, at=_dt("2026-11-16T18:30"))
    b.process_candles(T, _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    b.submit_order(T, "VENDA", 5, None, at=_dt("2026-11-17T18:30"))
    fills = b.process_candles(T, _c([("2026-11-18", 120505, 120700, 120400, 120600)]))
    assert fills[0].qty == 2 and b.position_qty(T) == 0  # sem virar a mão


def test_reinicio_reconstroi_vendido_com_stop_e_alvo(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "VENDA", 1, 121000, at=_dt("2026-11-16T18:30"), target=117000)
    b.process_candles(T, _c([("2026-11-17", 120000, 120500, 119500, 120200)]))
    again = _broker(engine)
    assert again.position_qty(T) == -1
    assert again.portfolio({T: 119000}).equity == pytest.approx(b.portfolio({T: 119000}).equity)
    fills = again.process_candles(T, _c([("2026-11-18", 120200, 121100, 120100, 121050)]))
    assert fills and fills[0].reason == "stop"


def test_ordem_de_zerar_sem_posicao_e_recusada(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "COMPRA", 1, None, at=_dt("2026-11-16T18:30"))  # "zerar" (sem stop)
    fills = b.process_candles(T, _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    assert fills == [] and b.position_qty(T) == 0
    assert b.list_orders()[0].status == "rejected"


def test_abrir_com_posicao_do_outro_lado_e_recusado(engine) -> None:  # type: ignore[no-untyped-def]
    b = _broker(engine)
    b.submit_order(T, "COMPRA", 3, 119000, at=_dt("2026-11-16T18:30"), target=122000)
    b.process_candles(T, _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    b.submit_order(T, "VENDA", 1, 121500, at=_dt("2026-11-17T18:30"), target=118000)
    b.process_candles(T, _c([("2026-11-18", 120300, 120700, 120200, 120500)]))
    assert b.position_qty(T) == 3  # abertura só a partir de zerado
    assert b.list_orders()[0].status == "rejected"


def test_reinicio_nao_aplica_stop_de_ordem_que_reduziu(engine) -> None:  # type: ignore[no-untyped-def]
    # dado antigo: uma abertura vendida que só REDUZIU um comprado (não pode mais acontecer)
    from sqlalchemy import insert

    from app.db.models import orders

    rows = [
        ("a", "COMPRA", 6, 119000.0, 122000.0, 1, 120000.0),
        ("b", "VENDA", 3, 121500.0, 118000.0, 2, 120300.0),
    ]
    with engine.begin() as conn:
        for oid, side, qty, stop, target, day, price in rows:
            ts = int(_dt(f"2026-11-1{6 + day}T00:00").timestamp())
            conn.execute(
                insert(orders).values(
                    account_id="w1",
                    id=oid,
                    cycle_id=None,
                    ticker=T,
                    side=side,
                    qty=qty,
                    stop=stop,
                    target=target,
                    reason="decisao",
                    status="filled",
                    created_ts=ts - 3600,
                    filled_ts=ts,
                    filled_qty=qty,
                    fill_price=price,
                    fee=0.5 * qty,
                    note="",
                )
            )
    b = _broker(engine)
    assert b.position_qty(T) == 3
    assert b._positions[T].stop == 119000.0  # o stop do comprado continua


def test_rastreador_usa_o_contrato_de_cada_ativo(engine) -> None:  # type: ignore[no-untyped-def]
    wdo = ContractSpec(multiplier=10, fee_per_contract=1.2, margin_per_contract=9000)
    b = FuturesBroker(engine, initial_cash=100_000, spec={"WIN": WIN, "WDO": wdo}, account_id="q1")
    b.submit_order("WIN", "COMPRA", 1, 119000, at=_dt("2026-11-16T18:30"))
    b.submit_order("WDO", "VENDA", 1, 5900, at=_dt("2026-11-16T18:30"))
    b.process_candles("WIN", _c([("2026-11-17", 120000, 120600, 119800, 120400)]))
    b.process_candles("WDO", _c([("2026-11-17", 5800, 5810, 5790, 5795)]))
    assert b.margin_used() == pytest.approx(4000 + 9000)
    assert b.exposure("WDO") == pytest.approx(9000)
    snap = b.portfolio({"WIN": 120105, "WDO": 5790})
    # WIN: (120105 − 120005) × 0,20 = 20; WDO vendido: (5800 − 5790) × 10 = 100; custos 0,50 + 1,20
    assert snap.equity == pytest.approx(100_000 - 0.5 - 1.2 + 20 + 100)
