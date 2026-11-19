"""NewsStore: RSS, filtro por termos, cache e proteção contra look-ahead."""

from datetime import datetime, timedelta

import pytest

from app.clock import TZ_BRASILIA
from app.data.news import NewsStore, fold, google_news_url, matches, terms_for
from app.db.models import make_engine

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Feed Teste</title>
<item>
  <title>Petrobras anuncia dividendos - Valor</title>
  <link>https://exemplo.com/1</link>
  <pubDate>Tue, 17 Nov 2026 12:00:00 GMT</pubDate>
  <source url="https://valor.example">Valor</source>
  <description>&lt;b&gt;Conselho&lt;/b&gt; aprova pagamento</description>
</item>
<item>
  <title>PETR4 sobe 2% no fim do dia</title>
  <link>https://exemplo.com/2</link>
  <pubDate>Wed, 18 Nov 2026 20:00:00 GMT</pubDate>
</item>
<item>
  <title>Vale divulga producao trimestral</title>
  <link>https://exemplo.com/3</link>
  <pubDate>Tue, 17 Nov 2026 13:00:00 GMT</pubDate>
</item>
<item>
  <title>Petrobras sem data publicada</title>
  <link>https://exemplo.com/4</link>
</item>
<item>
  <title>ITAU UNIBANCO tem lucro recorde</title>
  <link>https://exemplo.com/5</link>
  <pubDate>Tue, 17 Nov 2026 14:00:00 GMT</pubDate>
</item>
</channel></rss>"""


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ_BRASILIA)


class FakeFeeds:
    def __init__(self, payload: bytes = RSS) -> None:
        self.payload = payload
        self.calls: list[str] = []

    def fetch(self, url: str) -> bytes:
        self.calls.append(url)
        return self.payload


@pytest.fixture
def fake() -> FakeFeeds:
    return FakeFeeds()


def _store(fetcher: object, wall_t: float | None = None) -> NewsStore:
    wall = wall_t if wall_t is not None else _dt("2026-11-19T10:00:00").timestamp()
    return NewsStore(
        make_engine("sqlite://"),
        fetcher,  # type: ignore[arg-type]
        extra_feeds=[],
        ttl_s=900,
        wall_clock=lambda: wall,
    )


def test_fold_e_matches_ignoram_acento_e_caixa() -> None:
    assert fold("Itaú") == "itau"
    assert matches("ITAU UNIBANCO tem lucro", ["Itaú"])
    assert not matches("Petrolífera chinesa", ["Petrobras"])
    assert not matches("Avaliação da Valeria", ["Vale"])  # palavra inteira


def test_terms_for_conhecidos_e_desconhecidos() -> None:
    assert "Petrobras" in terms_for("PETR4.SA")
    assert terms_for("WEGE3.SA") == ["WEGE3"]


def test_google_news_url_monta_busca() -> None:
    url = google_news_url(["PETR4", "Petrobras"])
    assert url.startswith("https://news.google.com/rss/search?q=")
    assert "hl=pt-BR" in url


def test_noticia_futura_nao_vaza(fake: FakeFeeds) -> None:
    store = _store(fake)
    # 18/11 14:00 BRT = 17:00 UTC; o item 2 é das 20:00 UTC
    itens = store.get_news(
        "PETR4.SA", since=_dt("2026-11-10T00:00:00"), until=_dt("2026-11-18T14:00:00")
    )
    assert [i.link for i in itens] == ["https://exemplo.com/1"]
    assert all(i.published <= _dt("2026-11-18T14:00:00") for i in itens)


def test_ordem_mais_recente_primeiro(fake: FakeFeeds) -> None:
    store = _store(fake)
    itens = store.get_news(
        "PETR4.SA", since=_dt("2026-11-10T00:00:00"), until=_dt("2026-11-19T00:00:00")
    )
    assert [i.link for i in itens] == ["https://exemplo.com/2", "https://exemplo.com/1"]


def test_since_filtra_antigas(fake: FakeFeeds) -> None:
    store = _store(fake)
    itens = store.get_news(
        "PETR4.SA", since=_dt("2026-11-18T00:00:00"), until=_dt("2026-11-19T00:00:00")
    )
    assert [i.link for i in itens] == ["https://exemplo.com/2"]


def test_item_sem_data_e_descartado(fake: FakeFeeds) -> None:
    store = _store(fake)
    itens = store.get_news(
        "PETR4.SA", since=_dt("2026-01-01T00:00:00"), until=_dt("2026-12-31T00:00:00")
    )
    assert "https://exemplo.com/4" not in [i.link for i in itens]


def test_fonte_e_resumo_limpos(fake: FakeFeeds) -> None:
    store = _store(fake)
    item = store.get_news(
        "PETR4.SA", since=_dt("2026-11-10T00:00:00"), until=_dt("2026-11-18T00:00:00")
    )[0]
    assert item.source == "Valor"
    assert item.title == "Petrobras anuncia dividendos"
    assert item.summary == "Conselho aprova pagamento"


def test_cache_evita_nova_busca(fake: FakeFeeds) -> None:
    store = _store(fake)
    janela = {"since": _dt("2026-11-10T00:00:00"), "until": _dt("2026-11-19T00:00:00")}
    store.get_news("PETR4.SA", **janela)
    store.get_news("PETR4.SA", **janela)
    assert len(fake.calls) == 1


def test_falha_de_rede_retorna_vazio_sem_quebrar() -> None:
    class Quebrado:
        def fetch(self, url: str) -> bytes:
            raise TimeoutError("sem rede")

    store = _store(Quebrado())
    assert (
        store.get_news(
            "PETR4.SA", since=_dt("2026-11-10T00:00:00"), until=_dt("2026-11-19T00:00:00")
        )
        == []
    )


def test_tickers_diferentes_nao_se_misturam(fake: FakeFeeds) -> None:
    store = _store(fake)
    janela = {"since": _dt("2026-11-10T00:00:00"), "until": _dt("2026-11-19T00:00:00")}
    itau = store.get_news("ITUB4.SA", **janela)
    assert [i.link for i in itau] == ["https://exemplo.com/5"]
    assert all(i.ticker == "ITUB4.SA" for i in itau)


def test_feed_extra_tambem_e_filtrado(fake: FakeFeeds) -> None:
    store = NewsStore(
        make_engine("sqlite://"),
        fake,
        extra_feeds=["https://feed.example/rss"],
        ttl_s=900,
        wall_clock=lambda: _dt("2026-11-19T10:00:00").timestamp(),
    )
    itens = store.get_news(
        "VALE3.SA", since=_dt("2026-11-10T00:00:00"), until=_dt("2026-11-19T00:00:00")
    )
    assert [i.link for i in itens] == ["https://exemplo.com/3"]
    assert len(fake.calls) == 2  # Google News + feed extra


def test_janela_maxima(fake: FakeFeeds) -> None:
    store = _store(fake)
    until = _dt("2026-11-19T00:00:00")
    itens = store.get_news("PETR4.SA", since=until - timedelta(hours=1), until=until)
    assert itens == []
