"""Agendador: um job por robô habilitado; app de teste não liga o agendador."""

from fastapi.testclient import TestClient

from app.config import Settings
from app.engine.scheduler import build_scheduler
from app.main import create_app
from app.office.config import OfficeConfig
from tests.fakes import FakePrices
from tests.test_engine_step import ROBOT, _ctx


def _office(*robots: dict) -> OfficeConfig:  # type: ignore[type-arg]
    return OfficeConfig.model_validate(
        {"rooms": [{"id": "acoes", "name": "Ações"}], "robots": list(robots)}
    )


def test_um_job_por_robo_habilitado() -> None:
    ctx = _ctx()
    other = {**ROBOT.model_dump(), "id": "orion", "interval": "1h"}
    ctx.office = _office(ROBOT.model_dump(), other)
    sched = build_scheduler(ctx)
    ids = sorted(j.id for j in sched.get_jobs())
    assert ids == ["robot:orion", "robot:rigel"]
    job = sched.get_job("robot:rigel")
    assert job.max_instances == 1 and job.coalesce is True


def test_robo_desabilitado_sem_job() -> None:
    ctx = _ctx()
    ctx.office = _office({**ROBOT.model_dump(), "enabled": False})
    assert build_scheduler(ctx).get_jobs() == []


def test_app_de_teste_nao_inicia_agendador() -> None:
    settings = Settings(_env_file=None, database_url="sqlite://")
    app = create_app(settings, price_fetcher=FakePrices("alta"), start_scheduler=False)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert app.state.scheduler is None


def test_robo_de_cripto_decide_todo_dia_as_21h05() -> None:
    from tests.test_engine_crypto import _ctx as crypto_ctx

    ctx = crypto_ctx()
    (job,) = build_scheduler(ctx).get_jobs()
    trigger = str(job.trigger)
    assert "hour='21'" in trigger and "minute='5'" in trigger
    assert "mon-fri" not in trigger  # 24/7: sábado e domingo também
