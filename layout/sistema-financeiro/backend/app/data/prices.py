"""Candles da B3 via yfinance, com cache em SQLite.

Regra de look-ahead: um candle só é entregue quando já está COMPLETO no
instante pedido (`available_ts <= until`). Para candles diários consideramos
o fechamento às 18h (horário de Brasília), depois do leilão de fechamento.
"""

import logging
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Literal, Protocol

import pandas as pd
from sqlalchemy import Engine, and_, select
from sqlalchemy.dialects.sqlite import insert

from app.clock import TZ_BRASILIA
from app.db.models import candles, fetch_log

log = logging.getLogger(__name__)

Interval = Literal["1d", "1h"]
COLUMNS = ["open", "high", "low", "close", "volume"]
DAILY_CLOSE_HOUR = 18


class PriceFetcher(Protocol):
    def fetch(
        self, ticker: str, start: datetime, end: datetime, interval: Interval
    ) -> pd.DataFrame: ...


class YFinanceFetcher:
    """Busca no Yahoo Finance (não oficial e com atraso: serve só para estudo)."""

    def fetch(
        self, ticker: str, start: datetime, end: datetime, interval: Interval
    ) -> pd.DataFrame:
        import yfinance as yf

        df = yf.Ticker(ticker).history(
            start=start.date().isoformat(),
            end=(end.date() + timedelta(days=1)).isoformat(),
            interval=interval,
            auto_adjust=True,
            actions=False,
        )
        if df.empty:
            return _empty()
        df = df.rename(columns=str.lower)[COLUMNS]
        idx = pd.DatetimeIndex(df.index)
        df.index = (idx.tz_localize("UTC") if idx.tz is None else idx).tz_convert(TZ_BRASILIA)
        return df


def _empty() -> pd.DataFrame:
    return pd.DataFrame(columns=COLUMNS, index=pd.DatetimeIndex([], tz=TZ_BRASILIA, name="time"))


def is_24h(ticker: str | None) -> bool:
    """Mercado de 24h: câmbio (`=X`) e cripto (`-USD`) do yfinance. O candle diário não
    segue o pregão da B3 (cripto: 00:00 UTC = 21h de Brasília do dia anterior)."""
    return ticker is not None and (ticker.endswith("=X") or ticker.endswith("-USD"))


def available_at(ts: pd.Timestamp, interval: Interval, ticker: str | None = None) -> pd.Timestamp:
    """Instante em que o candle aberto em `ts` está completo.

    B3: candle diário completo às 18h do próprio dia (depois do leilão de fechamento).
    24h (câmbio): o yfinance marca o diário à meia-noite de Londres (21h de Brasília do
    dia anterior); ele só fecha 24h depois da abertura. Usar a regra da B3 aqui seria
    entregar ao robô um candle que ainda está sendo negociado (look-ahead, regra 5).
    """
    ts = ts.tz_convert(TZ_BRASILIA)
    if interval == "1d":
        if is_24h(ticker):
            return ts + pd.Timedelta(days=1)
        return ts.normalize() + pd.Timedelta(hours=DAILY_CLOSE_HOUR)
    return ts + pd.Timedelta(hours=1)


class PriceStore:
    def __init__(
        self,
        engine: Engine,
        fetcher: PriceFetcher,
        ttl_s: int = 900,
        wall_clock: Callable[[], float] = time.time,
    ) -> None:
        self._engine = engine
        self._fetcher = fetcher
        self._ttl_s = ttl_s
        self._wall = wall_clock

    def get_candles(
        self,
        ticker: str,
        until: datetime,
        lookback_days: int = 365,
        interval: Interval = "1d",
        refresh: bool = True,
    ) -> pd.DataFrame:
        """Candles completos no instante `until`, dos últimos `lookback_days` dias.

        `refresh=False`: só o cache (telas de consulta; quem atualiza é o motor dos robôs).
        """
        until = until.astimezone(TZ_BRASILIA)
        start = (until - timedelta(days=lookback_days)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        if refresh:
            self._refresh_if_needed(ticker, interval, start, until)

        stmt = (
            select(candles)
            .where(
                and_(
                    candles.c.ticker == ticker,
                    candles.c.interval == interval,
                    candles.c.ts >= int(start.timestamp()),
                    candles.c.available_ts <= int(until.timestamp()),
                )
            )
            .order_by(candles.c.ts)
        )
        with self._engine.connect() as conn:
            rows = conn.execute(stmt).mappings().all()
        if not rows:
            return _empty()
        index = pd.DatetimeIndex(
            pd.to_datetime([r["ts"] for r in rows], unit="s", utc=True), name="time"
        ).tz_convert(TZ_BRASILIA)
        return pd.DataFrame({c: [r[c] for r in rows] for c in COLUMNS}, index=index)

    # ---------- cache ----------

    def _refresh_if_needed(
        self, ticker: str, interval: Interval, start: datetime, until: datetime
    ) -> None:
        key = f"prices|{ticker}|{interval}"
        now_wall = self._wall()
        with self._engine.connect() as conn:
            entry = conn.execute(select(fetch_log).where(fetch_log.c.key == key)).mappings().first()

        start_ts = int(start.timestamp())
        if entry is not None:
            needs_older = start_ts < entry["start_ts"]
            needs_newer = (
                until.timestamp() > entry["fetched_ts"]
                and now_wall - entry["fetched_ts"] > self._ttl_s
            )
            if not (needs_older or needs_newer):
                return
            start_ts = min(start_ts, entry["start_ts"])

        fetch_start = datetime.fromtimestamp(start_ts, TZ_BRASILIA)
        fetch_end = datetime.fromtimestamp(now_wall, TZ_BRASILIA)
        try:
            df = self._fetcher.fetch(ticker, fetch_start, fetch_end, interval)
        except Exception as exc:  # rede fora, Yahoo instável etc.: segue com o cache
            log.warning("Falha ao buscar %s (%s): %r — usando cache", ticker, interval, exc)
            return

        self._save(ticker, interval, df, fetched_at=fetch_end)
        with self._engine.begin() as conn:
            stmt = insert(fetch_log).values(key=key, fetched_ts=int(now_wall), start_ts=start_ts)
            conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[fetch_log.c.key],
                    set_={
                        "fetched_ts": stmt.excluded.fetched_ts,
                        "start_ts": stmt.excluded.start_ts,
                    },
                )
            )

    def _save(
        self, ticker: str, interval: Interval, df: pd.DataFrame, fetched_at: datetime
    ) -> None:
        df = df.dropna(subset=["open", "high", "low", "close"])
        # DATA-001: um candle que ainda não fechou no momento da busca é parcial.
        # Gravá-lo com available_ts futuro faria ele "virar completo" depois,
        # mesmo sem nova busca. Só candles já fechados entram no cache.
        if not df.empty:
            limit = pd.Timestamp(fetched_at)
            complete = [available_at(ts, interval, ticker) <= limit for ts in df.index]
            df = df[complete]
        if df.empty:
            return
        rows = [
            {
                "ticker": ticker,
                "interval": interval,
                "ts": int(ts.timestamp()),
                "available_ts": int(available_at(ts, interval, ticker).timestamp()),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(0 if pd.isna(row["volume"]) else row["volume"]),
            }
            for ts, row in df.iterrows()
        ]
        with self._engine.begin() as conn:
            # lotes de 500 linhas: o SQLite limita a quantidade de parâmetros por comando
            for i in range(0, len(rows), 500):
                stmt = insert(candles).values(rows[i : i + 500])
                conn.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[candles.c.ticker, candles.c.interval, candles.c.ts],
                        set_={c: stmt.excluded[c] for c in [*COLUMNS, "available_ts"]},
                    )
                )
