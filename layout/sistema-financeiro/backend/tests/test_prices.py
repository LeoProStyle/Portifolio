"""PriceStore: cache SQLite e proteção contra look-ahead (regra nº 5)."""

from datetime import datetime, timedelta

import pandas as pd
import pytest

from app.clock import TZ_BRASILIA
from app.data.prices import PriceStore, available_at, is_24h
from app.db.models import make_engine


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ_BRASILIA)


class FakeFetcher:
    """Simula o yfinance: candles diários de 2026-10-01 a 2026-11-18."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, datetime, datetime, str]] = []

    def fetch(self, ticker: str, start: datetime, end: datetime, interval: str) -> pd.DataFrame:
        self.calls.append((ticker, start, end, interval))
        idx = pd.date_range("2026-10-01", "2026-11-18", freq="D", tz=TZ_BRASILIA)
        idx = idx[(idx >= pd.Timestamp(start).normalize()) & (idx <= pd.Timestamp(end))]
        closes = [float(i) for i in range(len(idx))]
        return pd.DataFrame(
            {
                "open": closes,
                "high": [c + 1 for c in closes],
                "low": closes,
                "close": closes,
                "volume": 100.0,
            },
            index=idx,
        )


class WallClock:
    def __init__(self, start: datetime) -> None:
        self.t = start.timestamp()

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def setup() -> tuple[PriceStore, FakeFetcher, WallClock]:
    fetcher = FakeFetcher()
    wall = WallClock(_dt("2026-11-18T19:00:00"))
    store = PriceStore(make_engine("sqlite://"), fetcher, ttl_s=900, wall_clock=wall)
    return store, fetcher, wall


def test_available_at_diario_e_horario() -> None:
    dia = pd.Timestamp("2026-11-18", tz=TZ_BRASILIA)
    assert available_at(dia, "1d") == pd.Timestamp("2026-11-18 18:00", tz=TZ_BRASILIA)
    hora = pd.Timestamp("2026-11-18 10:00", tz=TZ_BRASILIA)
    assert available_at(hora, "1h") == pd.Timestamp("2026-11-18 11:00", tz=TZ_BRASILIA)


def test_candle_do_dia_so_aparece_depois_do_fechamento(setup) -> None:
    store, _, _ = setup
    durante_pregao = store.get_candles("PETR4.SA", until=_dt("2026-11-18T14:00:00"))
    assert durante_pregao.index[-1].date().isoformat() == "2026-11-17"

    depois = store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))
    assert depois.index[-1].date().isoformat() == "2026-11-18"


def test_nenhum_candle_posterior_ao_instante_simulado(setup) -> None:
    store, _, _ = setup
    until = _dt("2026-11-05T12:00:00")
    df = store.get_candles("PETR4.SA", until=until, lookback_days=60)
    assert not df.empty
    assert all(available_at(ts, "1d") <= pd.Timestamp(until) for ts in df.index)


def test_cache_evita_nova_busca(setup) -> None:
    store, fetcher, _ = setup
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))
    assert len(fetcher.calls) == 1


def test_cache_expirado_busca_de_novo(setup) -> None:
    store, fetcher, wall = setup
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))
    wall.t += 901
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T19:10:00"))
    assert len(fetcher.calls) == 2


def test_replay_no_passado_usa_cache_mesmo_expirado(setup) -> None:
    store, fetcher, wall = setup
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"), lookback_days=60)
    wall.t += 10_000
    store.get_candles("PETR4.SA", until=_dt("2026-11-01T12:00:00"), lookback_days=20)
    assert len(fetcher.calls) == 1


def test_periodo_mais_antigo_que_o_cache_busca_de_novo(setup) -> None:
    store, fetcher, _ = setup
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"), lookback_days=10)
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"), lookback_days=40)
    assert len(fetcher.calls) == 2


def test_falha_na_busca_usa_cache_existente(setup) -> None:
    store, fetcher, wall = setup
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))

    def quebra(*_: object) -> pd.DataFrame:
        raise ConnectionError("sem internet")

    fetcher.fetch = quebra  # type: ignore[method-assign]
    wall.t += 901
    df = store.get_candles("PETR4.SA", until=_dt("2026-11-18T19:10:00"))
    assert not df.empty


def test_janela_lookback(setup) -> None:
    store, _, _ = setup
    df = store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"), lookback_days=5)
    assert df.index[0] >= pd.Timestamp(_dt("2026-11-18T18:30:00") - timedelta(days=5)).normalize()


# ---------- DATA-001: candle incompleto nunca é gravado como completo ----------


def test_candle_parcial_nao_e_gravado() -> None:
    fetcher = FakeFetcher()
    wall = WallClock(_dt("2026-11-18T15:48:00"))  # busca durante o pregão
    store = PriceStore(make_engine("sqlite://"), fetcher, ttl_s=900, wall_clock=wall)
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T15:48:00"))
    wall.t += 5 * 60  # ainda dentro do TTL
    df = store.get_candles("PETR4.SA", until=_dt("2026-11-18T18:30:00"))
    assert df.index[-1].date().isoformat() == "2026-11-17"


def test_candle_parcial_e_substituido_depois_do_fechamento() -> None:
    fetcher = FakeFetcher()
    wall = WallClock(_dt("2026-11-18T15:48:00"))
    store = PriceStore(make_engine("sqlite://"), fetcher, ttl_s=900, wall_clock=wall)
    store.get_candles("PETR4.SA", until=_dt("2026-11-18T15:48:00"))
    wall.t = _dt("2026-11-18T19:00:00").timestamp()  # TTL expirou, candle fechou
    df = store.get_candles("PETR4.SA", until=_dt("2026-11-18T19:00:00"))
    assert df.index[-1].date().isoformat() == "2026-11-18"


def test_candle_24h_so_fica_pronto_24h_depois() -> None:
    # câmbio no yfinance: candle diário marcado à meia-noite de Londres = 21h de Brasília
    # do dia ANTERIOR. Às 18h de 18/11 o candle "de 18/11" ainda está sendo negociado.
    ts = pd.Timestamp("2026-11-17 21:00", tz=TZ_BRASILIA)
    assert available_at(ts, "1d", "USDBRL=X") == pd.Timestamp("2026-11-18 21:00", tz=TZ_BRASILIA)
    assert available_at(ts, "1h", "USDBRL=X") == pd.Timestamp("2026-11-17 22:00", tz=TZ_BRASILIA)
    # ações e índice da B3 seguem a regra do pregão (18h do próprio dia)
    dia = pd.Timestamp("2026-11-18 00:00", tz=TZ_BRASILIA)
    assert available_at(dia, "1d", "^BVSP") == pd.Timestamp("2026-11-18 18:00", tz=TZ_BRASILIA)
    assert is_24h("USDBRL=X") and not is_24h("PETR4.SA") and not is_24h(None)
    assert is_24h("BTC-USD") and is_24h("SOL-USD")  # cripto: 24/7, candle de 00:00 UTC


def test_leitura_sem_atualizar_nao_busca_na_rede(setup) -> None:  # type: ignore[no-untyped-def]
    store, fetcher, _ = setup
    until = _dt("2026-11-18T19:00:00")
    store.get_candles("PETR4.SA", until=until, lookback_days=30)
    calls = len(fetcher.calls)
    df = store.get_candles("PETR4.SA", until=until, lookback_days=30, refresh=False)
    assert len(fetcher.calls) == calls and not df.empty  # só o cache, nenhuma busca nova
