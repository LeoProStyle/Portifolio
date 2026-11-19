"""Contas por robô: tabela runs e account_id nas tabelas da carteira.

Dados antigos (Fases 1–4, carteira única) vão para a execução `legacy-mesa-ia`
do robô `mesa-ia`, sem perder nada.

Revision ID: 0002
Revises: 0001
"""

import time

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

LEGACY = "legacy-mesa-ia"


def upgrade() -> None:
    bind = op.get_bind()
    op.create_table(
        "runs",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("robot_id", sa.String, nullable=False),
        sa.Column("mode", sa.String, nullable=False),
        sa.Column("config_hash", sa.String, nullable=False),
        sa.Column("initial_cash", sa.Float, nullable=False),
        sa.Column("started_ts", sa.Integer, nullable=False),
        sa.Column("ended_ts", sa.Integer, nullable=True),
    )
    op.create_index("ix_runs_robot_id", "runs", ["robot_id"])

    had_data = any(
        bind.execute(sa.text(f"SELECT COUNT(*) FROM {t}")).scalar_one()
        for t in ("orders", "equity_history", "broker_cursor")
    )
    if had_data:
        bind.execute(
            sa.text(
                "INSERT INTO runs VALUES (:id, 'mesa-ia', 'live', 'legacy', 100000, :ts, NULL)"
            ),
            {"id": LEGACY, "ts": int(time.time())},
        )

    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("account_id", sa.String, nullable=False, server_default=LEGACY))
        batch.create_index("ix_orders_account_id", ["account_id"])

    # PK composta: recria as duas tabelas copiando os dados
    op.create_table(
        "equity_history_new",
        sa.Column("account_id", sa.String, primary_key=True),
        sa.Column("ts", sa.Integer, primary_key=True),
        sa.Column("cash", sa.Float, nullable=False),
        sa.Column("equity", sa.Float, nullable=False),
    )
    bind.execute(
        sa.text("INSERT INTO equity_history_new SELECT :acc, ts, cash, equity FROM equity_history"),
        {"acc": LEGACY},
    )
    op.drop_table("equity_history")
    op.rename_table("equity_history_new", "equity_history")

    op.create_table(
        "broker_cursor_new",
        sa.Column("account_id", sa.String, primary_key=True),
        sa.Column("ticker", sa.String, primary_key=True),
        sa.Column("last_candle_ts", sa.Integer, nullable=False),
    )
    bind.execute(
        sa.text(
            "INSERT INTO broker_cursor_new SELECT :acc, ticker, last_candle_ts FROM broker_cursor"
        ),
        {"acc": LEGACY},
    )
    op.drop_table("broker_cursor")
    op.rename_table("broker_cursor_new", "broker_cursor")


def downgrade() -> None:
    raise NotImplementedError("Sem downgrade: restaure o backup do banco.")
