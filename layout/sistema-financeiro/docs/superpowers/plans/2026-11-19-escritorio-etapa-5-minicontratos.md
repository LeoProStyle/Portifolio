# Escritório — Etapa 5: Sala de Minicontratos — Plano

> Execução: superpowers:executing-plans (inline). Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** abrir o andar de **Minicontratos B3** (mini-índice WIN e mini-dólar WDO) com robôs que operam **contratos inteiros**, com **margem**, **custo fixo por contrato**, **slippage em pontos** e **venda a descoberto**, usando **proxies declarados** (`^BVSP` e `USDBRL=X × 1000`), tudo em paper trading.

**Architecture:** uma conta de futuro é diferente de uma conta de ações: o caixa só muda com o resultado em pontos × multiplicador e com os custos; a posição pode ser negativa (vendido). Isso fica numa subclasse `FuturesBroker(PaperBroker)` que reaproveita a persistência (ordens, cursor, patrimônio) e troca a contabilidade. Instrumentos ficam no `office.yaml` (`instruments:`), e um alimentador (`data/instruments.py`) entrega candles do proxy já em pontos. Estratégias continuam "long-only" e puras; o lado vendido é a **mesma estratégia rodando na série invertida (1/preço)**, combinada por uma função pura. O motor ganha um ramo de futuros (`engine/futures.py`) chamado por `decide_step`; ações não mudam.

**Tech Stack:** o que já existe. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` §6.2 (Minicontratos), §7 (risco por robô adaptado: margem e contrato inteiro), §8 (backtest, benchmark de 1 contrato de WIN), §11 (andar no HUD).

## Global Constraints
- Somente paper trading; nenhuma ordem real. Nada de opções binárias.
- Proxies declarados na tela e na API: WIN ≈ `^BVSP` (pontos); WDO ≈ `USDBRL=X × 1000`. Sem base nem rolagem de vencimento (aviso na sala e no painel do robô).
- Contratos inteiros. Multiplicador: WIN R$ 0,20/ponto; WDO R$ 10,00/ponto. Custo fixo por contrato e margem por contrato **configuráveis** no YAML.
- Compra e venda a descoberto permitidas (só a partir de posição zerada; sem virar a mão numa ordem só).
- **Sem look-ahead (regra 5):** mercado de 24h (`=X`) tem candle diário completo só 24h depois da abertura do candle (o yfinance marca meia-noite de Londres = 21h de Brasília do dia anterior).
- Risco em código: risco máx. por operação (`MAX_RISK_PER_TRADE`), perda diária (`MAX_DAILY_LOSS`), margem livre, exposição da sala medida em margem. Saída nunca é bloqueada.
- Benchmark da sala: 1 contrato de WIN comprado e segurado (em R$ sobre o capital inicial).
- Textos e comentários em português.

## Review Focus
1. Proxy `USDBRL=X` com candle marcado às 21h do dia anterior → o robô às 18:05 só vê o candle que terminou às 21h de ontem (Task 2: `test_candle_24h_so_fica_pronto_24h_depois`).
2. Robô vendido com stop acima: máxima do candle toca o stop → zera comprando; gap acima → sai na abertura (Task 3).
3. Margem insuficiente → quantidade reduzida/rejeitada com motivo; nunca fica com margem negativa por abrir posição (Task 3).
4. Reiniciar o servidor com posição vendida aberta → posição, stop e alvo reconstruídos iguais (Task 3: rebuild).
5. Robô de ações nada muda (suíte atual inteira verde; `_trades_today` equivalente).

---

### Task 1: Configuração — instrumentos, sala `minis`, robôs com `short`
**Files:** `app/office/config.py`, `office.yaml`, `tests/test_office_config.py`
- `InstrumentConfig(symbol, name, source, scale=1, multiplier, fee_per_contract, margin_per_contract, slippage_points)`; `OfficeConfig.instruments: list[InstrumentConfig] = []`, `instrument(symbol)`.
- `RoomId = Literal["acoes", "minis"]`; `RobotConfig.short: bool = False` (entra no hash).
- `load_office`: ticker do robô precisa estar em `TICKERS` **ou** ser símbolo de instrumento; `short=True` só para instrumento.
- `office.yaml`: sala `minis` + instrumentos WIN/WDO + 3 robôs (SIRIUS WIN sma_cross, ALTAIR WIN donchian, POLARIS WDO atr_trend), todos `short: true`, `min_avg_volume: 0`.
- Testes: yaml do repo carrega com a sala minis; short em ação → erro; símbolo desconhecido → erro; `short` muda o hash.

### Task 2: Dados — candle de 24h e alimentador de instrumento
**Files:** `app/data/prices.py`, `app/data/instruments.py`, `tests/test_prices.py`, `tests/test_instruments.py`
- `available_at(ts, interval, ticker=None)`: se `is_24h(ticker)` (termina em `=X`), diário = `ts + 24h`, 1h = `ts + 1h`; senão, regra atual. `PriceStore` passa o ticker (cache e consulta).
- `InstrumentFeed(prices).get_candles(inst, until, lookback_days, interval)` → candles do `source` com OHLC × `scale`.
- Testes: `test_candle_24h_so_fica_pronto_24h_depois`; escala ×1000 do WDO; ação continua 18h.

### Task 3: FuturesBroker
**Files:** `app/broker/futures.py`, `app/broker/paper.py` (método `exposure`), `tests/test_futures_broker.py`
- `ContractSpec(multiplier, fee_per_contract, margin_per_contract, slippage_points)`.
- Posição com sinal; caixa só recebe resultado realizado (`(saída − entrada) × qtd × mult × lado`) e paga custos; patrimônio = caixa + não realizado.
- Execução na abertura do candle seguinte ± `slippage_points` contra quem opera; abrir limitado pela margem livre; fechar sempre permitido até a posição; sem virar a mão.
- Stop/alvo dos dois lados (vendido: stop acima, alvo abaixo; stop primeiro); stop só se aproxima do preço.
- `exposure(ticker)` = |qtd| × margem (ações: qtd × preço médio).
- Testes: compra e venda com resultado à mão (WIN 1 contrato, +500 pts = +R$ 100 − custos); venda a descoberto com lucro na queda; stop de vendido; margem insuficiente reduz; rebuild igual após reiniciar.

### Task 4: Sinais dos dois lados e tamanho em contratos
**Files:** `app/strategies/sides.py`, `app/strategies/exits.py`, `tests/test_sides.py`, `tests/test_strategies.py`
- `invert(candles)`: 1/preço (alta↔baixa trocadas), volume igual.
- `combine(position, long_sig, short_sig) -> Intent(kind: 'comprar'|'vender'|'zerar'|'esperar', reason)`.
- `plan_exit(entry, atr, atr_mult, r_multiple, side="COMPRA")`: vendido → stop acima, alvo abaixo.
- `size_contracts(equity, free_margin, entry, stop, spec, max_risk, daily_pnl_pct, max_daily_loss) -> (qty, notes)`.
- Testes à mão para cada um.

### Task 5: Motor de futuros + backtest
**Files:** `app/engine/futures.py`, `app/engine/step.py`, `app/office/accounts.py`, `app/engine/office_risk.py`, `app/backtest/runner.py`, `app/backtest/metrics.py`, `app/main.py`, `tests/test_engine_futures.py`, `tests/test_backtest_metrics.py`
- `AccountRegistry(..., contracts: dict[robot_id, ContractSpec])` → `broker_for` cria `FuturesBroker` para esses robôs.
- `robot_step` usa o `InstrumentFeed` para robôs de instrumento; `decide_step` filtra prontidão com o ticker de origem e desvia para `futures_step`.
- `_trades_today` conta ordens de abertura (com stop), dos dois lados.
- `office_risk.exposure` usa `broker.exposure`.
- Backtest: candles pelo alimentador; benchmark = 1 contrato do instrumento (ativo) e 1 contrato de WIN (índice); `round_trips(fills, multiplier)` com vendido; slippage em pontos.
- Testes: robô vendido abre short na queda e zera; eventos com room `minis`; backtest de robô WIN roda e não mexe no ao vivo.

### Task 6: API e andar de Minicontratos no frontend
**Files:** `app/office/routes.py`, `tests/test_api_office.py`, `frontend/src/panels/robots.ts(+test)`, `frontend/src/office/office.ts(+test)`, `frontend/src/office/useOfficeStore.ts`, `frontend/src/room/floors/TradingFloor.tsx`, `frontend/src/room/Room3D.tsx`, `frontend/src/panels/RobotsPanel.tsx`, `frontend/src/panels/RobotDetail.tsx`
- Linha do robô ganha `instrument: {symbol, name, proxy, multiplier} | null`.
- Andar Minis habilitado; cena reaproveita `TradingFloor` (sem ilha da Mesa IA), placa "MINICONTRATOS · proxy"; aviso de proxy na tabela e no painel; status "vendido (n)"; abrir robô de minis não troca o ativo do gráfico de ações.

### Task 7: Docs e verificação real
- `PROGRESSO.md`, `CLAUDE.md`, `README.md`, `.env.example` se preciso.
- Suítes + lint; subir backend e rodar um passo real dos 3 robôs (yfinance) e um backtest de 2 anos de um robô WIN; abrir o andar no navegador.
