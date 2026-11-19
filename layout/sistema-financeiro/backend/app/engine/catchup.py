"""Recuperação de candles perdidos (backend desligado à noite, fim de semana etc.).

Cada execução guarda o último horário de decisão processado (`robot_cursor`).
Ao religar, o robô decide em cada horário perdido, EM ORDEM, usando só os
dados de cada instante, como um replay curto. O mesmo horário nunca decide
duas vezes. Horários vêm do calendário oficial da B3 (`BVMF`): pula fins de
semana e feriados.
"""

from datetime import datetime, timedelta
from functools import cache

import exchange_calendars as xc
import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from app.clock import TZ_BRASILIA
from app.db.models import robot_cursor
from app.engine.step import EngineContext, StepResult, robot_step
from app.office.config import OfficeConfig, RobotConfig

FIRST_START_WINDOW = timedelta(days=10)


@cache
def _calendar(name: str) -> xc.ExchangeCalendar:
    return xc.get_calendar(name)


CALENDAR_24X7 = "24x7"
DAILY_24X7 = (21, 0)  # cripto: o candle diário fecha às 21h de Brasília (00:00 UTC)


def _times_24x7(interval: str, since: datetime, until: datetime) -> list[datetime]:
    """Mercado 24/7: 1d = todo dia às 21:00 (fechamento do candle); 1h = toda hora cheia."""
    if interval == "1d":
        hour, minute = DAILY_24X7
        days = pd.date_range(since.date(), until.date(), freq="D")
        cands = [
            pd.Timestamp(d.date()).tz_localize(TZ_BRASILIA)
            + pd.Timedelta(hours=hour, minutes=minute)
            for d in days
        ]
    else:
        first = pd.Timestamp(since).tz_convert(TZ_BRASILIA).floor("h")
        cands = list(pd.date_range(first, pd.Timestamp(until), freq="1h"))
    return [t.to_pydatetime() for t in cands if since < t <= until]


def robot_calendar(office: OfficeConfig, robot: RobotConfig) -> str:
    """Calendário da sala do robô: B3 (BVMF) ou 24x7 (cripto)."""
    room = office.room(robot.room)
    return CALENDAR_24X7 if room is not None and room.calendar == "24x7" else "BVMF"


def decision_times(
    interval: str, since: datetime, until: datetime, calendar: str = "BVMF"
) -> list[datetime]:
    """Horários de decisão em (since, until]: 1d = fechamento do pregão; 1h = fim de cada hora."""
    if calendar == CALENDAR_24X7:
        return _times_24x7(interval, since, until)
    cal = _calendar(calendar)
    start = max(pd.Timestamp(since.date()), cal.first_session)
    end = min(pd.Timestamp(until.date()), cal.last_session)
    if start > end:
        return []
    out: list[datetime] = []
    for session in cal.sessions_in_range(start, end):
        close = cal.session_close(session).tz_convert(TZ_BRASILIA)
        if interval == "1d":
            candidates = [close]
        else:
            opened = cal.session_open(session).tz_convert(TZ_BRASILIA)
            candidates = list(pd.date_range(opened + pd.Timedelta(hours=1), close, freq="1h"))
        out.extend(t.to_pydatetime() for t in candidates if since < t <= until)
    return out


def _get_cursor(ctx: EngineContext, run_id: str) -> datetime | None:
    with ctx.accounts.engine.connect() as conn:
        ts = conn.execute(
            select(robot_cursor.c.last_decision_ts).where(robot_cursor.c.run_id == run_id)
        ).scalar()
    return None if ts is None else datetime.fromtimestamp(ts, TZ_BRASILIA)


def _set_cursor(ctx: EngineContext, run_id: str, at: datetime) -> None:
    stmt = insert(robot_cursor).values(run_id=run_id, last_decision_ts=int(at.timestamp()))
    with ctx.accounts.engine.begin() as conn:
        conn.execute(
            stmt.on_conflict_do_update(
                index_elements=[robot_cursor.c.run_id],
                set_={"last_decision_ts": stmt.excluded.last_decision_ts},
            )
        )


async def catch_up(ctx: EngineContext, robot: RobotConfig, now: datetime) -> list[StepResult]:
    """Processa os horários pendentes do robô até `now` (um catch-up por robô por vez)."""
    async with ctx.robot_lock(robot.id):
        return await _catch_up(ctx, robot, now)


async def _catch_up(ctx: EngineContext, robot: RobotConfig, now: datetime) -> list[StepResult]:
    run_id = ctx.accounts.live_run(robot, now)
    cursor = _get_cursor(ctx, run_id)
    cal = robot_calendar(ctx.office, robot)
    if cursor is None:
        # primeiro start da execução: só o horário mais recente (histórico é backtest)
        times = decision_times(robot.interval, now - FIRST_START_WINDOW, now, cal)[-1:]
    else:
        times = decision_times(robot.interval, cursor, now, cal)
    results: list[StepResult] = []
    for at in times:
        result = await robot_step(ctx, robot, at)
        if result is not None:
            results.append(result)
        _set_cursor(ctx, run_id, at)  # depois do passo: o mesmo horário não decide de novo
    return results
