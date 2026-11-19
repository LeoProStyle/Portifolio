"""Notícias via RSS (feedparser), filtradas por ticker e com cache em SQLite.

Regras:
- Só entram itens com data de publicação. Sem data não dá para garantir que
  a notícia não é do "futuro" num replay, então ela é descartada.
- `get_news` devolve apenas itens com `since <= published <= until` (regra nº 5).
- Fontes: Google News RSS por termo (sempre) + feeds extras de NEWS_FEEDS.
"""

import calendar
import hashlib
import html
import logging
import re
import time
import unicodedata
import urllib.request
from collections.abc import Callable
from datetime import datetime
from typing import Protocol
from urllib.parse import quote_plus

import feedparser
from pydantic import BaseModel
from sqlalchemy import Engine, and_, select
from sqlalchemy.dialects.sqlite import insert

from app.clock import TZ_BRASILIA
from app.db.models import fetch_log, news

log = logging.getLogger(__name__)

TICKER_TERMS: dict[str, list[str]] = {
    "PETR4.SA": ["PETR4", "Petrobras"],
    "VALE3.SA": ["VALE3", "Vale"],
    "ITUB4.SA": ["ITUB4", "Itaú", "Itau Unibanco"],
    "BBDC4.SA": ["BBDC4", "Bradesco"],
    "^BVSP": ["Ibovespa"],
}
MAX_FEED_BYTES = 5 * 1024 * 1024
SUMMARY_MAX = 300


class NewsItem(BaseModel):
    id: str
    ticker: str
    title: str
    link: str
    source: str
    published: datetime
    summary: str


class FeedFetcher(Protocol):
    def fetch(self, url: str) -> bytes: ...


class HttpFeedFetcher:
    def __init__(self, timeout_s: float = 10) -> None:
        self._timeout = timeout_s

    def fetch(self, url: str) -> bytes:
        if not url.startswith(("https://", "http://")):
            raise ValueError(f"URL de feed inválida: {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "trading-room-study/0.1"})
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:  # noqa: S310
            return resp.read(MAX_FEED_BYTES)


def terms_for(ticker: str) -> list[str]:
    return TICKER_TERMS.get(ticker, [ticker.split(".")[0]])


def google_news_url(terms: list[str]) -> str:
    query = " OR ".join(f'"{t}"' if " " in t else t for t in terms)
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419"


def fold(text: str) -> str:
    """Minúsculas e sem acento, para comparar termos."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).casefold()


def matches(text: str, terms: list[str]) -> bool:
    folded = fold(text)
    return any(re.search(rf"\b{re.escape(fold(t))}\b", folded) for t in terms)


def _clean(text: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", html.unescape(text or ""))
    return re.sub(r"\s+", " ", no_tags).strip()[:SUMMARY_MAX]


class NewsStore:
    def __init__(
        self,
        engine: Engine,
        fetcher: FeedFetcher,
        extra_feeds: list[str],
        ttl_s: int = 900,
        wall_clock: Callable[[], float] = time.time,
    ) -> None:
        self._engine = engine
        self._fetcher = fetcher
        self._extra_feeds = extra_feeds
        self._ttl_s = ttl_s
        self._wall = wall_clock

    def feeds_for(self, ticker: str) -> list[str]:
        return [google_news_url(terms_for(ticker)), *self._extra_feeds]

    def get_news(
        self, ticker: str, since: datetime, until: datetime, limit: int = 20
    ) -> list[NewsItem]:
        for url in self.feeds_for(ticker):
            self._refresh_if_needed(ticker, url, until)

        stmt = (
            select(news)
            .where(
                and_(
                    news.c.ticker == ticker,
                    news.c.published_ts >= int(since.timestamp()),
                    news.c.published_ts <= int(until.timestamp()),
                )
            )
            .order_by(news.c.published_ts.desc())
            .limit(limit)
        )
        with self._engine.connect() as conn:
            rows = conn.execute(stmt).mappings().all()
        return [
            NewsItem(
                id=r["id"],
                ticker=r["ticker"],
                title=r["title"],
                link=r["link"],
                source=r["source"],
                published=datetime.fromtimestamp(r["published_ts"], TZ_BRASILIA),
                summary=r["summary"],
            )
            for r in rows
        ]

    # ---------- cache ----------

    def _refresh_if_needed(self, ticker: str, url: str, until: datetime) -> None:
        key = f"news|{ticker}|{url}"
        now_wall = self._wall()
        with self._engine.connect() as conn:
            entry = conn.execute(select(fetch_log).where(fetch_log.c.key == key)).mappings().first()
        if entry is not None and (
            until.timestamp() <= entry["fetched_ts"]
            or now_wall - entry["fetched_ts"] <= self._ttl_s
        ):
            return

        try:
            raw = self._fetcher.fetch(url)
        except Exception as exc:
            log.warning("Falha ao ler feed %s: %r", url, exc)
            return

        rows = self._parse(ticker, raw)
        with self._engine.begin() as conn:
            if rows:
                conn.execute(insert(news).values(rows).on_conflict_do_nothing())
            stmt = insert(fetch_log).values(key=key, fetched_ts=int(now_wall), start_ts=None)
            conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[fetch_log.c.key],
                    set_={"fetched_ts": stmt.excluded.fetched_ts},
                )
            )

    def _parse(self, ticker: str, raw: bytes) -> list[dict[str, object]]:
        parsed = feedparser.parse(raw)
        feed_title = _clean(parsed.feed.get("title", "")) or "RSS"
        terms = terms_for(ticker)
        rows: list[dict[str, object]] = []
        seen: set[str] = set()
        for entry in parsed.entries:
            link = entry.get("link", "")
            title = _clean(entry.get("title", ""))
            published = entry.get("published_parsed") or entry.get("updated_parsed")
            if not link or not title or published is None:
                continue
            summary = _clean(entry.get("summary", ""))
            if not matches(f"{title} {summary}", terms):
                continue
            item_id = hashlib.sha1(link.encode()).hexdigest()
            if item_id in seen:
                continue
            seen.add(item_id)
            source = _clean(entry.get("source", {}).get("title") or feed_title)
            # Google News termina o título com " - Fonte"; a fonte já tem campo próprio
            title = title.removesuffix(f" - {source}")
            rows.append(
                {
                    "id": item_id,
                    "ticker": ticker,
                    "title": title,
                    "link": link,
                    "source": source,
                    # feedparser devolve struct_time em UTC
                    "published_ts": calendar.timegm(published),
                    "summary": summary,
                }
            )
        return rows
