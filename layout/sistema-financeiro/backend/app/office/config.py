"""Configuração do escritório: salas e robôs (arquivo office.yaml).

Cada robô = estratégia + parâmetros + ativo + capital inicial. O hash da
configuração identifica a "versão" do robô: mudou o hash, abre uma nova
execução (conta nova), para os números nunca misturarem configurações.
"""

import hashlib
import json
from decimal import Decimal
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, PrivateAttr

OFFICE_DEFAULT = Path(__file__).resolve().parents[2] / "office.yaml"

StrategyKind = Literal[
    "sma_cross",
    "rsi_reversion",
    "donchian",
    "atr_trend",
    "bull_flag",
    "ma20_reclaim",
    "oversold_bounce",
    "mesa_ia",
]
RoomId = Literal["acoes", "minis", "cripto"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StrategySpec(_Strict):
    kind: StrategyKind
    params: dict[str, float] = Field(default_factory=dict)


class RobotConfig(_Strict):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,30}$")
    name: str = Field(min_length=1, max_length=24)
    room: RoomId
    ticker: str
    interval: Literal["1d", "1h"] = "1d"
    strategy: StrategySpec
    initial_cash: Decimal = Decimal("100000")
    max_trades_per_day: int = Field(default=3, ge=1)
    min_avg_volume: float = Field(default=1_000_000, ge=0)
    enabled: bool = True
    # venda a descoberto (só para instrumentos de derivativos, ex.: minicontratos)
    short: bool = False
    # rastreador: escolhe entre estes ativos (lista FIXA e declarada); vazio = um ativo só
    universe: list[str] = Field(default_factory=list)
    max_positions: int = Field(default=3, ge=1, le=10)
    look: dict[str, str] = Field(default_factory=dict)
    # termos externos que mudam o resultado (contrato do instrumento, risco da sala);
    # preenchidos pelo OfficeConfig. Vazio para robôs de ação sem ajuste de sala.
    _terms: dict[str, object] = PrivateAttr(default_factory=dict)

    def config_hash(self) -> str:
        """sha256 do que muda o resultado (não inclui nome, aparência nem `enabled`)."""
        payload = {
            "strategy": self.strategy.model_dump(),
            "ticker": self.ticker,
            "interval": self.interval,
            "initial_cash": str(self.initial_cash),
            "max_trades_per_day": self.max_trades_per_day,
            "min_avg_volume": self.min_avg_volume,
            "short": self.short,
            # só rastreadores: robôs de um ativo mantêm o hash (não zera os 3 meses)
            **(
                {"universe": self.universe, "max_positions": self.max_positions}
                if self.universe
                else {}
            ),
            **self._terms,
        }
        blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(blob.encode()).hexdigest()[:16]


class InstrumentConfig(_Strict):
    """Contrato de derivativo simulado a partir de um PROXY (limitação declarada).

    Ex.: WIN ≈ ^BVSP em pontos; WDO ≈ USDBRL=X × 1000. Sem base nem rolagem.
    """

    symbol: str = Field(pattern=r"^[A-Z0-9]{2,10}$")
    name: str
    source: str  # ticker do yfinance usado como proxy
    scale: float = Field(default=1.0, gt=0)  # proxy × scale = preço em pontos
    multiplier: float = Field(gt=0)  # R$ por ponto por contrato
    fee_per_contract: float = Field(ge=0)  # custo fixo (corretagem + emolumentos)
    margin_per_contract: float = Field(gt=0)  # margem de garantia simulada
    slippage_points: float = Field(default=0.0, ge=0)  # sempre contra quem opera


class RoomConfig(_Strict):
    id: RoomId
    name: str
    max_daily_loss: Decimal = Decimal("0.03")
    max_instrument_exposure: Decimal = Decimal("0.40")
    # risco máximo por operação dos robôs da sala; vazio = MAX_RISK_PER_TRADE do .env
    max_risk_per_trade: Decimal | None = Field(default=None, gt=0, le=Decimal("0.05"))
    # moeda das contas da sala; o prédio soma tudo em BRL (câmbio do instante)
    currency: Literal["BRL", "USD"] = "BRL"
    # B3 = dias úteis e feriados da B3; 24x7 = todo dia (cripto)
    calendar: Literal["B3", "24x7"] = "B3"
    # ativos aceitos na sala além de TICKERS (ex.: BTC-USD)
    assets: list[str] = Field(default_factory=list)
    # custos da sala (vazio = FEE_PCT/SLIPPAGE_PCT do .env) e passo de quantidade
    fee_pct: Decimal | None = Field(default=None, ge=0, le=Decimal("0.02"))
    slippage_pct: Decimal | None = Field(default=None, ge=0, le=Decimal("0.02"))
    qty_step: Decimal = Field(default=Decimal("1"), gt=0)


class OfficeConfig(_Strict):
    rooms: list[RoomConfig]
    robots: list[RobotConfig]
    instruments: list[InstrumentConfig] = Field(default_factory=list)
    building_max_daily_loss: Decimal = Decimal("0.03")

    def model_post_init(self, __context: object) -> None:
        # mudar o contrato (multiplicador, proxy, custos) ou o risco da sala abre conta nova
        for robot in self.robots:
            terms: dict[str, object] = {}
            inst = self.instrument(robot.ticker)
            if inst is not None:
                terms["instrument"] = inst.model_dump()
            insts = [i.model_dump() for t in robot.universe if (i := self.instrument(t))]
            if insts:
                terms["instruments"] = insts
            room = self.room(robot.room)
            if room is not None and room.max_risk_per_trade is not None:
                terms["room_max_risk"] = str(room.max_risk_per_trade)
            if room is not None and room.currency != "BRL":
                terms["currency"] = room.currency
            if room is not None and (room.fee_pct, room.slippage_pct) != (None, None):
                terms["room_costs"] = [str(room.fee_pct), str(room.slippage_pct)]
            if room is not None and room.qty_step != 1:
                terms["qty_step"] = str(room.qty_step)
            robot._terms = terms

    def robot(self, robot_id: str) -> RobotConfig | None:
        return next((r for r in self.robots if r.id == robot_id), None)

    def room(self, room_id: str) -> RoomConfig | None:
        return next((r for r in self.rooms if r.id == room_id), None)

    def instrument(self, symbol: str) -> InstrumentConfig | None:
        return next((i for i in self.instruments if i.symbol == symbol), None)


def load_office(path: Path, *, tickers: list[str]) -> OfficeConfig:
    """Lê e valida o office.yaml. Falha cedo, dizendo o que está errado."""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    office = OfficeConfig.model_validate(data)
    seen: set[str] = set()
    for robot in office.robots:
        if robot.id in seen:
            raise ValueError(f"Robô com id duplicado no office.yaml: {robot.id}")
        seen.add(robot.id)
        room = office.room(robot.room)

        def valid(t: str, room: RoomConfig | None = room) -> bool:
            return (
                t in tickers
                or office.instrument(t) is not None
                or (room is not None and t in room.assets)
            )

        if robot.universe:
            bad = [t for t in robot.universe if not valid(t)]
            if bad:
                raise ValueError(f"Robô {robot.id}: ativos fora da sala/listas: {', '.join(bad)}")
            if robot.short and not all(office.instrument(t) for t in robot.universe):
                raise ValueError(
                    f"Robô {robot.id}: venda a descoberto só em instrumentos (minicontratos)"
                )
            continue
        is_instrument = office.instrument(robot.ticker) is not None
        in_room = room is not None and robot.ticker in room.assets
        if robot.ticker not in tickers and not is_instrument and not in_room:
            raise ValueError(
                f"Robô {robot.id}: ticker {robot.ticker} fora de TICKERS ({', '.join(tickers)}),"
                " não é instrumento declarado nem ativo da sala (assets)"
            )
        if robot.short and not is_instrument:
            raise ValueError(
                f"Robô {robot.id}: venda a descoberto só em instrumentos (minicontratos);"
                " ações operam só comprado"
            )
        if office.room(robot.room) is None:
            raise ValueError(f"Robô {robot.id}: sala {robot.room} não declarada em rooms")
    return office
