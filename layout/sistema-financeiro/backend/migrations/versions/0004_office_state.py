"""Pausas do escritório (sala/prédio) pelo Gerente Geral.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "office_state",
        sa.Column("scope", sa.String, primary_key=True),
        sa.Column("paused", sa.Integer, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("until_ts", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("office_state")
