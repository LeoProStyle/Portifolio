"""Grava todos os eventos da sala no SQLite.

O visual é teatro: a fonte de verdade é este log, que guarda o raciocínio
completo de cada agente em cada ciclo.
"""

import json
from typing import Any

from sqlalchemy import Engine, insert, select

from app.db.models import events_log
from app.events import Event


class EventStore:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def record(self, event: Event) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                insert(events_log).values(
                    cycle_id=str(event.cycle_id) if event.cycle_id else None,
                    type=event.type,
                    ts=int(event.ts.timestamp()),
                    json=event.model_dump_json(),
                )
            )

    def recent(self, limit: int = 300) -> list[dict[str, Any]]:
        """Últimos eventos, do mais antigo para o mais recente."""
        stmt = select(events_log.c.json).order_by(events_log.c.id.desc()).limit(limit)
        with self._engine.connect() as conn:
            rows = list(conn.execute(stmt).scalars())
        return [json.loads(r) for r in reversed(rows)]
