"""API do escritório: prédio, salas e robôs (cada robô = conta simulada própria).

Somente leitura de números + pausar/retomar. Pausa bloqueia só COMPRAS novas;
posições, stops e alvos continuam funcionando.
"""

import json
from collections.abc import Callable
from datetime import datetime
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import Engine, select

from app.broker.base import Order
from app.clock import Clock
from app.db.models import equity_history, events_log
from app.engine.office_risk import OfficeRisk, robot_scope
from app.office.accounts import AccountRegistry
from app.office.config import OfficeConfig, RobotConfig
from app.office.curves import sum_curves
from app.office.live import hold_return, live_days, live_summary

MANUAL_PAUSE = "pausa manual"


def order_json(o: Order) -> dict[str, Any]:
    return {
        "id": o.id,
        "cycle_id": o.cycle_id,
        "ticker": o.ticker,
        "side": o.side,
        "qty": o.qty,
        "stop": o.stop,
        "reason": o.reason,
        "status": o.status,
        "created_at": o.created_at.isoformat(),
        "filled_at": o.filled_at.isoformat() if o.filled_at else None,
        "filled_qty": o.filled_qty,
        "fill_price": o.fill_price,
        "fee": o.fee,
        "note": o.note,
    }


def _last_decision(engine: Engine, robot_id: str) -> dict[str, Any] | None:
    # o id do robô só tem [a-z0-9-] (validado na config): sem curingas no LIKE
    stmt = (
        select(events_log.c.json)
        .where(
            events_log.c.type == "decision",
            events_log.c.json.like(f'%"robot_id":"{robot_id}"%'),
        )
        .order_by(events_log.c.id.desc())
        .limit(1)
    )
    with engine.connect() as conn:
        raw = conn.execute(stmt).scalar()
    return None if raw is None else json.loads(raw)


def build_office_router(
    *,
    engine: Engine,
    clock: Clock,
    office: OfficeConfig,
    accounts: AccountRegistry,
    office_risk: OfficeRisk,
    # (robô, instante, dias, ativo) → candles completos do cache
    candles_for: Callable[[RobotConfig, datetime, int, str], pd.DataFrame] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api")

    def get_robot(robot_id: str) -> RobotConfig:
        robot = office.robot(robot_id)
        if robot is None:
            raise HTTPException(404, "Robô não encontrado no office.yaml")
        return robot

    def check_room(room: str) -> None:
        if office.room(room) is None:
            raise HTTPException(404, "Sala não encontrada no office.yaml")

    def curve(run_id: str) -> list[tuple[int, float]]:
        stmt = (
            select(equity_history.c.ts, equity_history.c.equity)
            .where(equity_history.c.account_id == run_id)
            .order_by(equity_history.c.ts)
        )
        with engine.connect() as conn:
            return [(int(ts), float(eq)) for ts, eq in conn.execute(stmt)]

    def spark(run_id: str, n: int = 30) -> list[float]:
        """Últimos `n` patrimônios da conta (mini-curva dos monitores da mesa)."""
        stmt = (
            select(equity_history.c.equity)
            .where(equity_history.c.account_id == run_id)
            .order_by(equity_history.c.ts.desc())
            .limit(n)
        )
        with engine.connect() as conn:
            values = [round(float(v), 2) for v in conn.execute(stmt).scalars()]
        return values[::-1]

    def live_block(
        robot: RobotConfig, info: dict[str, Any], now: datetime, robot_return: float
    ) -> dict[str, Any]:
        """Dias ao vivo e comprar e segurar desde o início da conta (só candles completos)."""
        started = int(info.get("started_ts") or now.timestamp())
        hold: float | None = None
        # Mesa IA opera vários ativos: comparar com um ativo só enganaria
        if candles_for is not None and robot.strategy.kind != "mesa_ia":
            # rastreador: cesta igual = média do comprar e segurar de cada ativo da lista
            holds = [
                h
                for t in (robot.universe or [robot.ticker])
                if (h := ticker_hold(robot, t, info, now, started)) is not None
            ]
            hold = sum(holds) / len(holds) if holds else None
        return live_summary(started, now, round(robot_return, 6), hold)

    def ticker_hold(
        robot: RobotConfig, ticker: str, info: dict[str, Any], now: datetime, started: int
    ) -> float | None:
        assert candles_for is not None
        df = candles_for(robot, now, live_days(started, now) + 10, ticker)
        if df.empty:
            return None
        after = df[[int(ts.timestamp()) > started for ts in df.index]]
        inst = office.instrument(ticker)
        return hold_return(
            [float(c) for c in after["close"]],
            inst.multiplier if inst else None,
            float(info.get("initial_cash") or 0.0),
        )

    def room_currency(room_id: str) -> str:
        cfg = office.room(room_id)
        return cfg.currency if cfg else "BRL"

    def instrument_info(robot: RobotConfig) -> dict[str, Any] | None:
        """Minicontrato: símbolo, proxy declarado e multiplicador (R$ por ponto)."""
        inst = office.instrument(robot.ticker)
        if inst is None:
            return None
        return {
            "symbol": inst.symbol,
            "name": inst.name,
            "proxy": inst.source,
            "scale": inst.scale,
            "multiplier": inst.multiplier,
        }

    def robot_row(robot: RobotConfig, now: datetime) -> dict[str, Any]:
        run_id = accounts.live_run(robot, now)
        info = accounts.run_info(run_id) or {}
        initial = float(info.get("initial_cash", 0.0))
        equity = office_risk.equity(run_id)
        day_pnl, day_pct = office_risk.day_pnl([run_id], now)
        last = _last_decision(engine, robot.id)
        payload = last["payload"] if last else {}
        # "livro" = caixa + custo das posições: separa P&L fechado (realizado) do aberto
        broker = accounts.broker_for(run_id)
        book_snap = broker.portfolio({})
        book = book_snap.equity
        positions = book_snap.positions
        return {
            "id": robot.id,
            "name": robot.name,
            "room": robot.room,
            "strategy": robot.strategy.kind,
            "ticker": robot.ticker,
            "interval": robot.interval,
            "run_id": run_id,
            "initial_cash": initial,
            "equity": round(equity, 2),
            "pnl": round(equity - initial, 2),
            "pnl_pct": round(equity / initial - 1, 6) if initial else 0.0,
            "realized_pnl": round(book - initial, 2),
            "unrealized_pnl": round(equity - book, 2),
            "day_pnl": round(day_pnl, 2),
            "day_pnl_pct": round(day_pct, 6),
            "spark": spark(run_id),
            "look": dict(robot.look),
            "instrument": instrument_info(robot),
            "currency": room_currency(robot.room),
            "live": live_block(robot, info, now, equity / initial - 1 if initial else 0.0),
            # rastreador: quantos ativos estão em carteira; demais: quantidade do ativo
            "open_qty": (len(positions) if robot.universe else broker.position_qty(robot.ticker)),
            "universe": list(robot.universe),
            "positions": [{"ticker": p.ticker, "qty": p.qty} for p in positions],
            "last_signal": payload.get("action") if last else None,
            "last_reason": payload.get("rationale") if last else None,
            "last_decision_ts": last["ts"] if last else None,
            "enabled": robot.enabled,
            "paused": office_risk.status(robot_scope(robot.id), now)[0],
        }

    @router.get("/building")
    def building() -> dict[str, Any]:
        now = clock.now()
        rooms = []
        for room in office.rooms:
            runs = office_risk.room_runs(room.id, now)
            day_pnl, day_pct = office_risk.day_pnl(runs, now)
            paused, reason = office_risk.status(room.id, now)
            equity = sum(office_risk.equity(r) for r in runs)
            rate = office_risk.rate(room.id, now)
            rooms.append(
                {
                    "id": room.id,
                    "name": room.name,
                    "currency": room.currency,
                    "robots": len(runs),
                    "equity": round(equity, 2),  # na moeda da sala
                    "day_pnl": round(day_pnl, 2),
                    "day_pnl_pct": round(day_pct, 6),
                    "fx_rate": rate,  # reais por unidade da moeda (BRL = 1)
                    "equity_brl": None if rate is None else round(equity * rate, 2),
                    "day_pnl_brl": None if rate is None else round(day_pnl * rate, 2),
                    "paused": paused,
                    "reason": reason,
                }
            )
        b_paused, b_reason = office_risk.status("building", now)
        known = [r for r in rooms if r["equity_brl"] is not None]
        return {
            "rooms": rooms,
            # consolidado SEMPRE em reais; sala sem cotação fica fora e o prédio avisa
            "equity": round(sum(r["equity_brl"] for r in known), 2),
            "day_pnl": round(sum(r["day_pnl_brl"] for r in known), 2),
            "fx_missing": len(known) < len(rooms),
            "paused": b_paused,
            "reason": b_reason,
            "as_of": now.isoformat(),
        }

    @router.get("/rooms/{room}/robots")
    def room_robots(room: str) -> list[dict[str, Any]]:
        check_room(room)
        now = clock.now()
        return [robot_row(r, now) for r in office.robots if r.room == room]

    @router.get("/rooms/{room}/equity")
    def room_equity(room: str) -> list[dict[str, Any]]:
        """Curva de patrimônio da sala: soma das contas ao vivo dos seus robôs."""
        check_room(room)
        runs = office_risk.room_runs(room, clock.now())
        curves = [
            (float((accounts.run_info(r) or {}).get("initial_cash", 0.0)), curve(r)) for r in runs
        ]
        return [{"time": ts, "value": v} for ts, v in sum_curves(curves)]

    @router.get("/robots/{robot_id}")
    def robot_detail(robot_id: str, limit: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
        robot = get_robot(robot_id)
        row = robot_row(robot, clock.now())
        broker = accounts.broker_for(row["run_id"])
        stmt = (
            select(equity_history.c.ts, equity_history.c.equity)
            .where(equity_history.c.account_id == row["run_id"])
            .order_by(equity_history.c.ts)
        )
        with engine.connect() as conn:
            curve = [
                {"time": int(ts), "value": round(float(eq), 2)} for ts, eq in conn.execute(stmt)
            ]
        return {
            **row,
            "orders": [order_json(o) for o in broker.list_orders(limit=limit)],
            "equity_curve": curve,
        }

    @router.post("/robots/{robot_id}/pause")
    def pause_robot(robot_id: str) -> dict[str, Any]:
        get_robot(robot_id)
        office_risk.pause(robot_scope(robot_id), MANUAL_PAUSE)
        return {"scope": robot_scope(robot_id), "paused": True}

    @router.post("/robots/{robot_id}/resume")
    def resume_robot(robot_id: str) -> dict[str, Any]:
        get_robot(robot_id)
        office_risk.resume(robot_scope(robot_id))
        return {"scope": robot_scope(robot_id), "paused": False}

    @router.post("/rooms/{room}/pause")
    def pause_room(room: str) -> dict[str, Any]:
        check_room(room)
        office_risk.pause(room, MANUAL_PAUSE)
        return {"scope": room, "paused": True}

    @router.post("/rooms/{room}/resume")
    def resume_room(room: str) -> dict[str, Any]:
        check_room(room)
        office_risk.resume(room)
        return {"scope": room, "paused": False}

    return router
