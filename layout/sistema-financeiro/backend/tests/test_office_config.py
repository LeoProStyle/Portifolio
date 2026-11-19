"""Configuração do escritório (office.yaml): validação e hash por robô."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.office.config import OFFICE_DEFAULT, RobotConfig, load_office

TICKERS = ["PETR4.SA", "VALE3.SA", "ITUB4.SA"]


def _write(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "office.yaml"
    p.write_text(body, encoding="utf-8")
    return p


def test_carrega_office_padrao() -> None:
    office = load_office(OFFICE_DEFAULT, tickers=TICKERS)
    ids = [r.id for r in office.robots]
    assert {"atlas", "orion", "vega", "rigel", "nova", "mesa-ia"} <= set(ids)
    assert {r.id for r in office.rooms} == {"acoes", "minis", "cripto"}
    minis = [r for r in office.robots if r.room == "minis" and not r.universe]
    assert {r.ticker for r in minis} == {"WIN", "WDO"} and all(r.short for r in minis)
    win = office.instrument("WIN")
    wdo = office.instrument("WDO")
    assert win is not None and win.source == "^BVSP" and win.multiplier == 0.2
    assert wdo is not None and wdo.source == "USDBRL=X" and wdo.scale == 1000
    assert wdo.multiplier == 10


BASE = """
rooms:
  - {id: acoes, name: Ações B3}
robots:
  - {id: a1, name: A1, room: acoes, ticker: PETR4.SA, strategy: {kind: sma_cross}}\n"""


def test_id_duplicado_falha(tmp_path: Path) -> None:
    body = (
        BASE + "  - {id: a1, name: B, room: acoes, ticker: VALE3.SA, strategy: {kind: donchian}}\n"
    )
    with pytest.raises(ValueError, match="a1"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_ticker_fora_da_lista_falha(tmp_path: Path) -> None:
    body = BASE.replace("PETR4.SA", "XYZ3.SA")
    with pytest.raises(ValueError, match="XYZ3.SA"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_estrategia_desconhecida_falha(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        load_office(_write(tmp_path, BASE.replace("sma_cross", "martingale")), tickers=TICKERS)


def test_campo_desconhecido_falha(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        load_office(
            _write(tmp_path, BASE.replace("room: acoes,", "room: acoes, foo: 1,")), tickers=TICKERS
        )


def test_hash_muda_com_parametro_e_nao_com_nome() -> None:
    base = {
        "id": "xx",
        "name": "X",
        "room": "acoes",
        "ticker": "PETR4.SA",
        "strategy": {"kind": "sma_cross"},
    }
    a = RobotConfig.model_validate(base)
    renomeado = RobotConfig.model_validate({**base, "name": "Outro", "look": {"hair": "#000"}})
    outro_param = RobotConfig.model_validate(
        {**base, "strategy": {"kind": "sma_cross", "params": {"fast": 5}}}
    )
    assert a.config_hash() == renomeado.config_hash()
    assert a.config_hash() != outro_param.config_hash()


MINIS = """
rooms:
  - {id: acoes, name: Ações B3}
  - {id: minis, name: Minicontratos B3}
instruments:
  - {symbol: WIN, name: Mini-índice, source: ^BVSP, multiplier: 0.2,
     fee_per_contract: 0.5, margin_per_contract: 4000, slippage_points: 5}
robots:
"""


def test_robo_de_instrumento_e_short(tmp_path: Path) -> None:
    body = MINIS + (
        "  - {id: w1, name: W1, room: minis, ticker: WIN, short: true,"
        " strategy: {kind: sma_cross}}\n"
    )
    office = load_office(_write(tmp_path, body), tickers=TICKERS)
    assert office.robot("w1").short is True  # type: ignore[union-attr]


def test_short_em_acao_falha(tmp_path: Path) -> None:
    body = MINIS + (
        "  - {id: a1, name: A1, room: acoes, ticker: PETR4.SA, short: true,"
        " strategy: {kind: sma_cross}}\n"
    )
    with pytest.raises(ValueError, match="venda a descoberto"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_simbolo_desconhecido_falha(tmp_path: Path) -> None:
    body = MINIS + "  - {id: w1, name: W1, room: minis, ticker: WXX, strategy: {kind: donchian}}\n"
    with pytest.raises(ValueError, match="WXX"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_short_muda_o_hash() -> None:
    base = {
        "id": "w1",
        "name": "W",
        "room": "minis",
        "ticker": "WIN",
        "strategy": {"kind": "sma_cross"},
    }
    a = RobotConfig.model_validate(base)
    b = RobotConfig.model_validate({**base, "short": True})
    assert a.config_hash() != b.config_hash()


def test_termos_do_contrato_entram_no_hash(tmp_path: Path) -> None:
    body = MINIS + "  - {id: w1, name: W1, room: minis, ticker: WIN, strategy: {kind: sma_cross}}\n"
    a = load_office(_write(tmp_path, body), tickers=TICKERS).robot("w1")
    b = load_office(
        _write(tmp_path, body.replace("multiplier: 0.2", "multiplier: 0.3")), tickers=TICKERS
    ).robot("w1")
    assert a is not None and b is not None
    assert a.config_hash() != b.config_hash()
    # robô de ação sem ajuste de sala mantém o hash de antes (contas atuais não reiniciam)
    acao = load_office(_write(tmp_path, BASE), tickers=TICKERS).robot("a1")
    solo = RobotConfig.model_validate(
        {
            "id": "a1",
            "name": "A1",
            "room": "acoes",
            "ticker": "PETR4.SA",
            "strategy": {"kind": "sma_cross"},
        }
    )
    assert acao is not None and acao.config_hash() == solo.config_hash()


def test_sala_de_cripto_em_dolar_24x7() -> None:
    office = load_office(OFFICE_DEFAULT, tickers=TICKERS)
    room = office.room("cripto")
    assert room is not None and room.currency == "USD" and room.calendar == "24x7"
    assert {"BTC-USD", "ETH-USD", "SOL-USD"} <= set(room.assets)
    robots = [r for r in office.robots if r.room == "cripto" and not r.universe]
    assert len(robots) == 4 and all(float(r.initial_cash) == 20_000 for r in robots)
    assert all(r.ticker in room.assets and not r.short for r in robots)


def test_ativo_fora_da_lista_da_sala_falha(tmp_path: Path) -> None:
    body = """
rooms:
  - {id: cripto, name: Cripto, currency: USD, calendar: 24x7, assets: [BTC-USD]}
robots:
  - {id: c1, name: C1, room: cripto, ticker: DOGE-USD, strategy: {kind: sma_cross}}
"""
    with pytest.raises(ValueError, match="DOGE-USD"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_rastreadores_em_cada_sala() -> None:
    office = load_office(OFFICE_DEFAULT, tickers=TICKERS)
    scanners = [r for r in office.robots if r.universe]
    assert {r.room for r in scanners} == {"acoes", "minis", "cripto"}
    acoes = next(r for r in scanners if r.room == "acoes")
    assert len(acoes.universe) >= 15 and all(t.endswith(".SA") for t in acoes.universe)
    minis = next(r for r in scanners if r.room == "minis")
    assert set(minis.universe) == {"WIN", "WDO"} and minis.short
    cripto = next(r for r in scanners if r.room == "cripto")
    assert len(cripto.universe) >= 8 and all(t.endswith("-USD") for t in cripto.universe)
    assert all(1 <= r.max_positions <= 10 for r in scanners)


def test_ativo_invalido_no_universo_falha(tmp_path: Path) -> None:
    body = BASE + (
        "  - {id: s1, name: S1, room: acoes, ticker: VARREDURA, universe: [PETR4.SA, XXXX3.SA],"
        " strategy: {kind: rsi_reversion}}\n"
    )
    with pytest.raises(ValueError, match="XXXX3.SA"):
        load_office(_write(tmp_path, body), tickers=TICKERS)


def test_universo_entra_no_hash_e_robo_de_um_ativo_nao_muda() -> None:
    base = {
        "id": "s1",
        "name": "S",
        "room": "acoes",
        "ticker": "VARREDURA",
        "strategy": {"kind": "rsi_reversion"},
    }
    a = RobotConfig.model_validate({**base, "universe": ["PETR4.SA", "VALE3.SA"]})
    b = RobotConfig.model_validate({**base, "universe": ["PETR4.SA", "ITUB4.SA"]})
    assert a.config_hash() != b.config_hash()
    solo = {
        "id": "a1",
        "name": "A1",
        "room": "acoes",
        "ticker": "PETR4.SA",
        "strategy": {"kind": "sma_cross"},
    }
    # campos novos com valor padrão não mudam o hash dos robôs que já existem
    assert RobotConfig.model_validate(solo).config_hash() == "df15e29627a2ded7"
