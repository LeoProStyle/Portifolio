"""Alvo (take-profit) nas ordens e cursor de decisão por execução.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("target", sa.Float, nullable=True))
    op.create_table(
        "robot_cursor",
        sa.Column("run_id", sa.String, primary_key=True),
        sa.Column("last_decision_ts", sa.Integer, nullable=False),
    )


def downgrade() -> None:
    raise NotImplementedError("Sem downgrade: restaure o backup do banco.")
