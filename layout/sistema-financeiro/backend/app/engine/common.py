"""Peças comuns aos passos de ações e de minicontratos."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Engine, func, select

from app.clock import TZ_BRASILIA
from app.db.models import orders
from app.strategies.base import Signal


@dataclass(frozen=True)
class Decision:
    """O que o passo decidiu (vira o evento `decision` e o StepResult)."""

    signal: Signal
    action: str  # COMPRA | VENDA | ESPERA (o lado da ordem criada)
    order_id: str | None = None
    blocked: str | None = None
    qty: int = 0
    stop: float | None = None


def trades_today(engine: Engine, run_id: str, at: datetime) -> int:
    """Ordens de ABERTURA do dia (têm stop), dos dois lados; saídas não contam."""
    day = at.astimezone(TZ_BRASILIA).replace(hour=0, minute=0, second=0, microsecond=0)
    with engine.connect() as conn:
        return int(
            conn.execute(
                select(func.count())
                .select_from(orders)
                .where(
                    orders.c.account_id == run_id,
                    orders.c.reason == "decisao",
                    orders.c.stop.is_not(None),
                    orders.c.created_ts >= int(day.timestamp()),
                    orders.c.created_ts < int((day + timedelta(days=1)).timestamp()),
                )
            ).scalar_one()
        )
