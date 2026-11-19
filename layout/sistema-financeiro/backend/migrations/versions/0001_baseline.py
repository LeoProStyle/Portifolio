"""Schema das Fases 1–4 (baseline).

Cria só as tabelas que ainda não existem: assim um banco antigo, criado com
`create_all` antes do Alembic, é adotado sem perder dados.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _create(name: str, *cols: sa.Column, indexes: tuple[tuple[str, list[str]], ...] = ()) -> None:
    if sa.inspect(op.get_bind()).has_table(name):
        return
    op.create_table(name, *cols)
    for idx_name, idx_cols in indexes:
        op.create_index(idx_name, name, idx_cols)


def upgrade() -> None:
    _create(
        "candles",
        sa.Column("ticker", sa.String, primary_key=True),
        sa.Column("interval", sa.String, primary_key=True),
        sa.Column("ts", sa.Integer, primary_key=True),
        sa.Column("available_ts", sa.Integer, nullable=False),
        sa.Column("open", sa.Float, nullable=False),
        sa.Column("high", sa.Float, nullable=False),
        sa.Column("low", sa.Float, nullable=False),
        sa.Column("close", sa.Float, nullable=False),
        sa.Column("volume", sa.Float, nullable=False),
        indexes=(("ix_candles_available_ts", ["available_ts"]),),
    )
    _create(
        "fetch_log",
        sa.Column("key", sa.String, primary_key=True),
        sa.Column("fetched_ts", sa.Integer, nullable=False),
        sa.Column("start_ts", sa.Integer, nullable=True),
    )
    _create(
        "news",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("ticker", sa.String, primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("link", sa.Text, nullable=False),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("published_ts", sa.Integer, nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        indexes=(("ix_news_published_ts", ["published_ts"]),),
    )
    _create(
        "orders",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("cycle_id", sa.String, nullable=True),
        sa.Column("ticker", sa.String, nullable=False),
        sa.Column("side", sa.String, nullable=False),
        sa.Column("qty", sa.Integer, nullable=False),
        sa.Column("stop", sa.Float, nullable=True),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("created_ts", sa.Integer, nullable=False),
        sa.Column("filled_ts", sa.Integer, nullable=True),
        sa.Column("filled_qty", sa.Integer, nullable=True),
        sa.Column("fill_price", sa.Float, nullable=True),
        sa.Column("fee", sa.Float, nullable=True),
        sa.Column("note", sa.Text, nullable=False),
        indexes=(("ix_orders_ticker", ["ticker"]), ("ix_orders_status", ["status"])),
    )
    _create(
        "equity_history",
        sa.Column("ts", sa.Integer, primary_key=True),
        sa.Column("cash", sa.Float, nullable=False),
        sa.Column("equity", sa.Float, nullable=False),
    )
    _create(
        "broker_cursor",
        sa.Column("ticker", sa.String, primary_key=True),
        sa.Column("last_candle_ts", sa.Integer, nullable=False),
    )
    _create(
        "events_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("cycle_id", sa.String, nullable=True),
        sa.Column("type", sa.String, nullable=False),
        sa.Column("ts", sa.Integer, nullable=False),
        sa.Column("json", sa.Text, nullable=False),
        indexes=(("ix_events_log_cycle_id", ["cycle_id"]), ("ix_events_log_ts", ["ts"])),
    )


def downgrade() -> None:
    for name in (
        "events_log",
        "broker_cursor",
        "equity_history",
        "orders",
        "news",
        "fetch_log",
        "candles",
    ):
        op.drop_table(name)
