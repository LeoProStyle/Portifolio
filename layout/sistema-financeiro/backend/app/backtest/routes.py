"""API de backtest por robô (Etapa 3).

- POST /api/robots/{id}/backtest  {start?, end?} (datas; padrão: últimos 2 anos)
- GET  /api/robots/{id}/backtests  resumos, mais recente primeiro
- GET  /api/backtests/{run_id}     resultado + curva de patrimônio + execuções

Um backtest por vez (o servidor é de uso pessoal; evita dois replays longos
disputando o banco). O segundo pedido recebe 409.
"""

import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.backtest.runner import BacktestError, get_backtest, list_backtests, run_backtest
from app.clock import TZ_BRASILIA
from app.engine.step import EngineContext

DEFAULT_DAYS = 730  # 2 anos: o mínimo do critério de candidato


class BacktestRequest(BaseModel):
    start: date | None = None
    end: date | None = None


def _period(req: BacktestRequest, now: datetime) -> tuple[datetime, datetime]:
    if req.end is None or req.end == now.date():
        end = now
    else:  # data futura vira 23:59 do dia e o runner recusa com mensagem clara
        end = datetime.combine(req.end, time(23, 59), TZ_BRASILIA)
    if req.start is None:
        start = (end - timedelta(days=DEFAULT_DAYS)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    else:
        start = datetime.combine(req.start, time(0, 0), TZ_BRASILIA)
    return start, end


def build_backtest_router(ctx: EngineContext, lock: asyncio.Lock) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.post("/robots/{robot_id}/backtest")
    async def run(robot_id: str, req: BacktestRequest) -> dict[str, Any]:
        robot = ctx.office.robot(robot_id)
        if robot is None:
            raise HTTPException(404, "Robô não encontrado no office.yaml")
        if lock.locked():
            raise HTTPException(409, "Já existe um backtest rodando. Aguarde ele terminar.")
        async with lock:
            start, end = _period(req, ctx.clock.now())
            try:
                return await run_backtest(ctx, robot, start, end)
            except BacktestError as exc:
                raise HTTPException(400, str(exc)) from exc

    @router.get("/robots/{robot_id}/backtests")
    def history(robot_id: str) -> list[dict[str, Any]]:
        if ctx.office.robot(robot_id) is None:
            raise HTTPException(404, "Robô não encontrado no office.yaml")
        return list_backtests(ctx.accounts.engine, robot_id)

    @router.get("/backtests/{run_id}")
    def detail(run_id: str) -> dict[str, Any]:
        result = get_backtest(ctx.accounts.engine, run_id)
        if result is None:
            raise HTTPException(404, "Backtest não encontrado")
        return result

    return router
