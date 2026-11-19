"""Agendador dos robôs (APScheduler, horário de Brasília).

Cada robô habilitado ganha um job que chama `catch_up`: com o backend ligado ele
decide no horário certo; se o PC ficou desligado, o mesmo catch_up recupera os
horários perdidos (o cursor garante que nada decide duas vezes).

- 1d: seg-sex 18:05 (o pregão fecha às 18h; 5 min de folga para o candle).
- 1h: seg-sex no minuto 5 das 11h às 18h (fim de cada hora de pregão).
Feriados não precisam de regra aqui: `decision_times` usa o calendário da B3.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.engine.catchup import CALENDAR_24X7, DAILY_24X7, catch_up, robot_calendar
from app.engine.step import EngineContext
from app.office.config import RobotConfig

log = logging.getLogger(__name__)

TZ = "America/Sao_Paulo"


def _trigger(interval: str, calendar: str = "BVMF") -> CronTrigger:
    if calendar == CALENDAR_24X7:  # cripto: todo dia, inclusive fim de semana
        # dispara 5 min depois do fechamento; o catch-up decide no horário do fechamento
        if interval == "1d":
            return CronTrigger(hour=DAILY_24X7[0], minute=5, timezone=TZ)
        return CronTrigger(minute=5, timezone=TZ)
    if interval == "1d":
        return CronTrigger(day_of_week="mon-fri", hour=18, minute=5, timezone=TZ)
    return CronTrigger(day_of_week="mon-fri", hour="11-18", minute=5, timezone=TZ)


async def _run_robot(ctx: EngineContext, robot: RobotConfig) -> None:
    try:
        await catch_up(ctx, robot, ctx.clock.now())
    except Exception:  # um robô com erro não derruba o agendador nem os outros
        log.exception("robô %s falhou no passo agendado", robot.id)


def build_scheduler(ctx: EngineContext) -> AsyncIOScheduler:
    """Cria (sem iniciar) o agendador com um job por robô habilitado."""
    sched = AsyncIOScheduler(timezone=TZ)
    for robot in ctx.office.robots:
        if not robot.enabled:
            continue
        sched.add_job(
            _run_robot,
            _trigger(robot.interval, robot_calendar(ctx.office, robot)),
            args=[ctx, robot],
            id=f"robot:{robot.id}",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
        )
    return sched


async def catch_up_all(ctx: EngineContext) -> None:
    """Ao ligar: recupera os horários perdidos de todos os robôs habilitados."""
    for robot in ctx.office.robots:
        if robot.enabled:
            await _run_robot(ctx, robot)
