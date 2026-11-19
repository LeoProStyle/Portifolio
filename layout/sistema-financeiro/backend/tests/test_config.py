"""Testes da leitura do .env."""

from pathlib import Path

from app.config import Settings

ENV_EXAMPLE = Path(__file__).resolve().parents[2] / ".env.example"


def test_env_example_e_valido_e_seguro() -> None:
    settings = Settings(_env_file=ENV_EXAMPLE)
    assert settings.llm_provider == "mock"
    assert settings.live_trading_enabled is False
    assert settings.tickers == ["PETR4.SA", "VALE3.SA", "ITUB4.SA"]
    assert settings.news_feeds == []
