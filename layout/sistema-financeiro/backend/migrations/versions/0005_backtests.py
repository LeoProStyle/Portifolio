"""Resultados de backtest por robô (Etapa 3).

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backtests",
        sa.Column("run_id", sa.String, primary_key=True),
        sa.Column("robot_id", sa.String, nullable=False, index=True),
        sa.Column("start_ts", sa.Integer, nullable=False),
        sa.Column("end_ts", sa.Integer, nullable=False),
        sa.Column("created_ts", sa.Integer, nullable=False),
        sa.Column("result_json", sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("backtests")
