"""Ambiente Alembic: usa a conexão de app.db.migrate.upgrade (ou a URL do alembic.ini)."""

from alembic import context
from sqlalchemy import create_engine

from app.db.models import metadata

config = context.config
connection = config.attributes.get("connection")


def _run(conn) -> None:  # type: ignore[no-untyped-def]
    # render_as_batch: o SQLite não tem ALTER TABLE completo; o Alembic recria a tabela
    context.configure(connection=conn, target_metadata=metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


if connection is not None:
    _run(connection)
else:
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    with engine.begin() as conn:
        _run(conn)
