"""Recuperação de candles perdidos: calendário B3, ordem e idempotência."""

import asyncio
from datetime import datetime, timedelta

from app.clock import TZ_BRASILIA
from app.engine import catchup as cu
from app.engine.catchup import catch_up, decision_times
from tests.test_engine_step import ROBOT, _ctx


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ_BRASILIA)


def test_decision_times_pula_fim_de_semana_e_feriado() -> None:
    times = decision_times("1d", _dt("2026-11-18T19:00:00"), _dt("2026-11-24T19:00:00"))
    # 19/11 (qui) · 20/11 feriado · 21-22 fim de semana · 23/11 (seg) · 24/11 (ter)
    assert [t.strftime("%d/%m %H:%M") for t in times] == [
        "19/11 18:00",
        "23/11 18:00",
        "24/11 18:00",
    ]


def test_decision_times_horario_so_no_pregao() -> None:
    times = decision_times("1h", _dt("2026-11-19T09:00:00"), _dt("2026-11-19T13:30:00"))
    assert [t.strftime("%H:%M") for t in times] == ["11:00", "12:00", "13:00"]


def test_primeiro_start_so_roda_o_ultimo_horario(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    calls: list[datetime] = []

    async def fake_step(ctx, robot, at):  # type: ignore[no-untyped-def]
        calls.append(at)

    monkeypatch.setattr(cu, "robot_step", fake_step)
    asyncio.run(catch_up(_ctx(), ROBOT, _dt("2026-11-24T19:00:00")))
    assert calls == [_dt("2026-11-24T18:00:00")]


def test_catch_up_simultaneo_do_mesmo_robo_nao_decide_duas_vezes(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    # recuperação ao ligar + job agendado das 18:05 podem rodar juntos
    calls: list[datetime] = []

    async def slow_step(ctx, robot, at):  # type: ignore[no-untyped-def]
        calls.append(at)
        await asyncio.sleep(0.01)  # cede o loop no meio do passo (como o publish de eventos)

    monkeypatch.setattr(cu, "robot_step", slow_step)
    ctx = _ctx()
    asyncio.run(catch_up(ctx, ROBOT, _dt("2026-11-18T19:00:00")))  # cursor = 18/11

    async def both() -> None:
        now = _dt("2026-11-24T19:00:00")
        await asyncio.gather(catch_up(ctx, ROBOT, now), catch_up(ctx, ROBOT, now))

    asyncio.run(both())
    assert [c.strftime("%d/%m") for c in calls] == ["18/11", "19/11", "23/11", "24/11"]


def test_catch_up_processa_em_ordem_e_nao_repete(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    calls: list[datetime] = []

    async def fake_step(ctx, robot, at):  # type: ignore[no-untyped-def]
        calls.append(at)

    monkeypatch.setattr(cu, "robot_step", fake_step)
    ctx = _ctx()
    asyncio.run(catch_up(ctx, ROBOT, _dt("2026-11-18T19:00:00")))  # cursor = 18/11
    asyncio.run(catch_up(ctx, ROBOT, _dt("2026-11-24T19:00:00")))  # PC "desligado" até 24/11
    asyncio.run(catch_up(ctx, ROBOT, _dt("2026-11-24T19:00:00")))  # de novo: nada novo
    assert [c.strftime("%d/%m") for c in calls] == ["18/11", "19/11", "23/11", "24/11"]


def test_horarios_24x7_incluem_fim_de_semana() -> None:
    from app.engine.catchup import decision_times

    since = datetime(2026, 11, 21, 0, 0, tzinfo=TZ_BRASILIA)  # sábado
    until = datetime(2026, 11, 23, 23, 0, tzinfo=TZ_BRASILIA)  # segunda
    times = decision_times("1d", since, until, calendar="24x7")
    assert [t.isoformat() for t in times] == [
        "2026-11-21T21:00:00-03:00",
        "2026-11-22T21:00:00-03:00",
        "2026-11-23T21:00:00-03:00",
    ]
    hourly = decision_times("1h", since, since + timedelta(hours=3), calendar="24x7")
    assert [t.hour for t in hourly] == [1, 2, 3] and all(t.minute == 0 for t in hourly)
