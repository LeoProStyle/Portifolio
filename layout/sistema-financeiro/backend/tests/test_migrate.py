"""Migrações Alembic: banco novo, adoção do banco antigo e PRAGMAs (DATA-007/009)."""

from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from app.db.migrate import HEAD, upgrade
from app.db.models import make_engine

# schema da Fase 3 (antes do Alembic), criado "à mão" para simular um banco antigo
LEGACY_ORDERS = """
CREATE TABLE orders (
    id VARCHAR PRIMARY KEY, cycle_id VARCHAR, ticker VARCHAR NOT NULL, side VARCHAR NOT NULL,
    qty INTEGER NOT NULL, stop FLOAT, reason VARCHAR NOT NULL, status VARCHAR NOT NULL,
    created_ts INTEGER NOT NULL, filled_ts INTEGER, filled_qty INTEGER, fill_price FLOAT,
    fee FLOAT, note TEXT NOT NULL
)
"""


def _version(url: str) -> str:
    with create_engine(url).connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_banco_novo_chega_na_versao_head(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'novo.db'}"
    engine = make_engine(url)
    tables = set(inspect(engine).get_table_names())
    assert {"candles", "news", "orders", "equity_history", "events_log", "backtests"} <= tables
    assert _version(url) == HEAD


def test_banco_antigo_e_adotado_sem_perder_dados(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'antigo.db'}"
    raw = create_engine(url)
    with raw.begin() as conn:
        conn.execute(text(LEGACY_ORDERS))
        conn.execute(
            text(
                "INSERT INTO orders VALUES ('o1', NULL, 'PETR4.SA', 'COMPRA', 10, NULL,"
                " 'decisao', 'pending', 1, NULL, NULL, NULL, NULL, '')"
            )
        )
    raw.dispose()

    engine = make_engine(url)  # adota e migra
    with engine.connect() as conn:
        ids = conn.execute(text("SELECT id FROM orders")).scalars().all()
    assert ids == ["o1"]
    assert _version(url) == HEAD


def test_upgrade_e_idempotente(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'x.db'}"
    engine = make_engine(url)
    upgrade(engine)  # de novo: nada muda, nada quebra
    assert _version(url) == HEAD


def test_wal_e_busy_timeout(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'w.db'}")
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar_one().lower() == "wal"
        assert conn.execute(text("PRAGMA busy_timeout")).scalar_one() == 5000


def test_memoria_continua_com_create_all() -> None:
    engine = make_engine("sqlite://")
    assert "orders" in inspect(engine).get_table_names()


def test_migracao_move_carteira_antiga_para_legacy(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'fase3.db'}"
    raw = create_engine(url)
    with raw.begin() as conn:
        conn.execute(text(LEGACY_ORDERS))
        conn.execute(
            text(
                "CREATE TABLE equity_history (ts INTEGER PRIMARY KEY, cash FLOAT NOT NULL,"
                " equity FLOAT NOT NULL)"
            )
        )
        conn.execute(text("INSERT INTO equity_history VALUES (1, 100000, 100000)"))
        conn.execute(
            text(
                "INSERT INTO orders VALUES ('o1', NULL, 'PETR4.SA', 'COMPRA', 10, NULL,"
                " 'decisao', 'filled', 1, 2, 10, 40.0, 0.1, '')"
            )
        )
    raw.dispose()
    engine = make_engine(url)
    with engine.connect() as conn:
        acc = conn.execute(text("SELECT account_id FROM orders WHERE id='o1'")).scalar_one()
        eq = conn.execute(text("SELECT account_id FROM equity_history")).scalar_one()
        run = conn.execute(text("SELECT robot_id FROM runs WHERE id='legacy-mesa-ia'")).scalar_one()
    assert acc == eq == "legacy-mesa-ia"
    assert run == "mesa-ia"
