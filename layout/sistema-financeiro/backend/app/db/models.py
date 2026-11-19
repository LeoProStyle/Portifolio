"""Tabelas SQLite (SQLAlchemy Core).

Datas são guardadas como epoch em segundos (int, UTC): comparação simples e
sem ambiguidade de fuso no SQLite.
"""

from sqlalchemy import (
    Column,
    Engine,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    event,
)
from sqlalchemy.pool import StaticPool

metadata = MetaData()

candles = Table(
    "candles",
    metadata,
    Column("ticker", String, primary_key=True),
    Column("interval", String, primary_key=True),
    Column("ts", Integer, primary_key=True),  # abertura do candle
    Column("available_ts", Integer, nullable=False, index=True),  # quando o candle fica completo
    Column("open", Float, nullable=False),
    Column("high", Float, nullable=False),
    Column("low", Float, nullable=False),
    Column("close", Float, nullable=False),
    Column("volume", Float, nullable=False),
)

fetch_log = Table(
    "fetch_log",
    metadata,
    Column("key", String, primary_key=True),  # ex.: "prices|PETR4.SA|1d" ou "news|<url>"
    Column("fetched_ts", Integer, nullable=False),  # relógio de parede, não o simulado
    Column("start_ts", Integer, nullable=True),
)

news = Table(
    "news",
    metadata,
    Column("id", String, primary_key=True),  # sha1 do link
    Column("ticker", String, primary_key=True),
    Column("title", Text, nullable=False),
    Column("link", Text, nullable=False),
    Column("source", String, nullable=False),
    Column("published_ts", Integer, nullable=False, index=True),
    Column("summary", Text, nullable=False, default=""),
)


# ---------- execuções / contas por robô ----------

runs = Table(
    "runs",
    metadata,
    Column("id", String, primary_key=True),  # também é o account_id da conta simulada
    Column("robot_id", String, nullable=False, index=True),
    Column("mode", String, nullable=False),  # live | backtest
    Column("config_hash", String, nullable=False),
    Column("initial_cash", Float, nullable=False),
    Column("started_ts", Integer, nullable=False),
    Column("ended_ts", Integer, nullable=True),  # null = execução aberta
)

# ---------- PaperBroker ----------

orders = Table(
    "orders",
    metadata,
    Column("id", String, primary_key=True),
    Column("account_id", String, nullable=False, index=True),  # = runs.id
    Column("cycle_id", String, nullable=True),
    Column("ticker", String, nullable=False, index=True),
    Column("side", String, nullable=False),  # COMPRA | VENDA
    Column("qty", Integer, nullable=False),  # quantidade pedida
    Column("stop", Float, nullable=True),
    Column("target", Float, nullable=True),  # alvo (take-profit)
    Column("reason", String, nullable=False),  # decisao | stop | alvo
    Column("status", String, nullable=False, index=True),  # pending | filled | rejected
    Column("created_ts", Integer, nullable=False),
    Column("filled_ts", Integer, nullable=True),  # abertura do candle de execução
    Column("filled_qty", Integer, nullable=True),
    Column("fill_price", Float, nullable=True),
    Column("fee", Float, nullable=True),
    Column("note", Text, nullable=False, default=""),
)

equity_history = Table(
    "equity_history",
    metadata,
    Column("account_id", String, primary_key=True),
    Column("ts", Integer, primary_key=True),
    Column("cash", Float, nullable=False),
    Column("equity", Float, nullable=False),
)

broker_cursor = Table(
    "broker_cursor",
    metadata,
    Column("account_id", String, primary_key=True),
    Column("ticker", String, primary_key=True),
    Column("last_candle_ts", Integer, nullable=False),  # último candle já processado
)

# ---------- motor: último horário de decisão processado por execução ----------

robot_cursor = Table(
    "robot_cursor",
    metadata,
    Column("run_id", String, primary_key=True),
    Column("last_decision_ts", Integer, nullable=False),
)

# ---------- escritório: pausas (Gerente Geral) ----------

office_state = Table(
    "office_state",
    metadata,
    Column("scope", String, primary_key=True),  # "building" ou id da sala
    Column("paused", Integer, nullable=False),  # 0/1
    Column("reason", Text, nullable=False, default=""),
    Column("until_ts", Integer, nullable=True),  # null = até "retomar" manual
)

# ---------- backtest (Etapa 3): resultado por execução mode="backtest" ----------

backtests = Table(
    "backtests",
    metadata,
    Column("run_id", String, primary_key=True),  # = runs.id (mode="backtest")
    Column("robot_id", String, nullable=False, index=True),
    Column("start_ts", Integer, nullable=False),
    Column("end_ts", Integer, nullable=False),
    Column("created_ts", Integer, nullable=False),  # relógio de parede
    Column("result_json", Text, nullable=False),  # métricas, veredito, benchmark
)

# ---------- eventos (rastreabilidade de tudo que a sala mostra) ----------

events_log = Table(
    "events_log",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("cycle_id", String, nullable=True, index=True),
    Column("type", String, nullable=False),
    Column("ts", Integer, nullable=False, index=True),
    Column("json", Text, nullable=False),
)


MEMORY_URLS = ("sqlite://", "sqlite:///:memory:")


def _sqlite_pragmas(dbapi_conn, _record) -> None:  # type: ignore[no-untyped-def]
    # WAL: leitura não trava escrita; busy_timeout: espera em vez de "database is locked"
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def make_engine(database_url: str) -> Engine:
    """Cria o engine e deixa o schema na versão atual.

    - `sqlite://` (memória, testes): `create_all`.
    - arquivo: PRAGMAs de robustez + migrações Alembic (`app/db/migrate.py`).
    """
    kwargs: dict[str, object] = {}
    is_memory = database_url in MEMORY_URLS
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if is_memory:
            kwargs["poolclass"] = StaticPool
    engine = create_engine(database_url, **kwargs)
    if is_memory:
        metadata.create_all(engine)
        return engine
    if database_url.startswith("sqlite"):
        event.listen(engine, "connect", _sqlite_pragmas)
    from app.db.migrate import upgrade  # import tardio: migrate importa este módulo

    upgrade(engine)
    return engine
