"""Configuração lida do .env (pydantic-settings).

Os nomes dos campos seguem a seção 12 do CLAUDE.md (sem diferenciar maiúsculas).
"""

from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    # env_ignore_empty: "CHAVE=" vazio no .env usa o valor padrão
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True
    )

    # LLM
    llm_provider: Literal["mock", "anthropic", "openai"] = "mock"
    llm_model: str = ""
    anthropic_api_key: str = Field(default="", repr=False)
    openai_api_key: str = Field(default="", repr=False)
    price_per_mtok_input: Decimal = Decimal("0")
    price_per_mtok_output: Decimal = Decimal("0")
    max_cost_per_day: Decimal = Decimal("1.00")

    # Mercado
    tickers: Annotated[list[str], NoDecode] = ["PETR4.SA", "VALE3.SA", "ITUB4.SA"]
    benchmark: str = "^BVSP"
    cycle_interval_min: int = Field(default=60, ge=15)
    news_feeds: Annotated[list[str], NoDecode] = []

    # PaperBroker e risco
    initial_cash: Decimal = Decimal("100000")
    fee_pct: Decimal = Decimal("0.0003")
    slippage_pct: Decimal = Decimal("0.0005")
    max_risk_per_trade: Decimal = Decimal("0.01")
    max_position_pct: Decimal = Decimal("0.20")
    max_daily_loss: Decimal = Decimal("0.03")
    atr_stop_mult: Decimal = Decimal("2")
    # Critério de "candidato a conta real" no backtest (spec §8); só sinalização
    candidate_max_drawdown: Decimal = Decimal("0.20")
    candidate_min_trades: int = Field(default=20, ge=1)

    # Segurança: só paper trading (regra inviolável nº 1)
    live_trading_enabled: bool = False

    database_url: str = "sqlite:///./trading_room.db"
    # salas e robôs do escritório (vazio = backend/office.yaml)
    office_config: str = ""

    # Frontend
    # 5173 = Vite (desenvolvimento); 8000 = tela compilada servida pelo próprio backend
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    # pasta da tela compilada (npm run build); vazio = ../frontend/dist
    frontend_dist: str = ""
    # SEC-001: só aceita requisições endereçadas a estes hosts (evita DNS rebinding)
    allowed_hosts: Annotated[list[str], NoDecode] = ["localhost", "127.0.0.1"]

    @field_validator("tickers", "news_feeds", "cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Aceita listas separadas por vírgula no .env."""
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("live_trading_enabled")
    @classmethod
    def _somente_paper(cls, value: bool) -> bool:
        if value:
            raise ValueError(
                "LIVE_TRADING_ENABLED=true não é suportado: este projeto opera "
                "somente em modo simulado (paper trading)."
            )
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
