"""Aplica as migrações Alembic no banco (ao subir o backend).

- Banco de arquivo novo ou antigo (Fases 1–4, sem Alembic): `upgrade head`.
  A baseline (0001) só cria tabelas que faltam, então o antigo é adotado
  sem perder dados.
- Banco em memória (`sqlite://`, testes): `metadata.create_all`.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def _config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    return cfg


HEAD: str = ScriptDirectory.from_config(_config()).get_current_head() or ""


def upgrade(engine: Engine) -> None:
    cfg = _config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
