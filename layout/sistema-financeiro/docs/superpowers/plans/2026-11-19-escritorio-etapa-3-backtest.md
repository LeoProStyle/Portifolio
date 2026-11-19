# Escritório — Etapa 3: Backtest por robô e métricas — Plano

> Execução: superpowers:executing-plans (inline). Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** rodar qualquer robô de regras num período histórico, numa conta separada, e mostrar métricas, comparação com benchmark e um veredito honesto ("passou no backtest" ≠ "pronto para conta real").

**Architecture:** o backtest reaproveita o MESMO passo do robô ao vivo (`engine/step.py`), com uma execução própria (`runs.mode="backtest"`), candles carregados uma vez e fatiados por instante (sem look-ahead), sem eventos na sala e sem risco do escritório. As métricas são funções puras (`backtest/metrics.py`). O resultado fica gravado (`backtests`, migração 0005) e é servido pela API e por um painel novo.

**Tech Stack:** o que já existe (FastAPI, SQLAlchemy Core, Alembic, pandas, exchange-calendars, React + lightweight-charts). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` §8 (Replay/backtest, critério de candidato) e §10 (`/api/robots/{id}/backtest`).

## Global Constraints
- Somente paper trading; o backtest nunca toca a conta ao vivo do robô (execução e `account_id` próprios).
- Sem look-ahead: em cada instante o robô só vê candles com `available_at <= instante` (mesmo filtro do ao vivo).
- Timeframe do backtest = o do robô. Robôs `1h`: período máximo de 729 dias (limite do yfinance).
- Mesa IA fora do backtest (spec §8): pedido para `mesa_ia` → HTTP 400 com o motivo.
- Custos: as mesmas taxas e slippage do PaperBroker (`FEE_PCT`, `SLIPPAGE_PCT`); execução na abertura do candle seguinte.
- Métricas (spec §8): retorno, drawdown máximo, taxa de acerto, fator de lucro, nº de operações, custos pagos, benchmark (buy-and-hold do ativo e do `^BVSP`) e custo de LLM (0 para robôs de regras).
- Critério de candidato (spec §8): backtest de ≥ 2 anos, bate o benchmark depois dos custos, drawdown ≤ teto configurável (`CANDIDATE_MAX_DRAWDOWN`, padrão 0,20); mais 3 meses ao vivo com a mesma configuração (só informado; não é calculado aqui).
- Tela de resultados mostra o aviso de limitação (CLAUDE.md §10) e "Simulação educacional. Não é recomendação de investimento."
- Textos e comentários em português.

## Review Focus
1. Período sem candles (feriado longo, ativo novo) → resultado com 0 operações e métricas neutras, sem erro 500.
2. Robô sem nenhuma operação fechada → taxa de acerto e fator de lucro `null`, veredito reprovado por amostra.
3. Dois backtests ao mesmo tempo → o segundo recebe 409; nenhum mistura contas.
4. `end` no futuro ou `start >= end` → 400.
5. Backtest não aparece no P&L do prédio/sala nem na tabela de robôs (só execuções `live`).

---

### Task 1: Núcleo do passo reutilizável
**Files:** `app/engine/step.py`, `tests/test_engine_step.py`
- Extrair `async def decide_step(ctx, robot, run_id, candles, at, *, emit=True) -> StepResult` com tudo o que `robot_step` faz depois de carregar candles (filtro `available_at`, broker, sinal, compra/venda, equity, eventos se `emit`).
- `robot_step` = `live_run` + `get_candles` + `decide_step`. Comportamento atual inalterado (suíte verde).
- Teste novo: `test_decide_step_sem_emit_nao_publica_eventos`.

### Task 2: Métricas puras
**Files:** `app/backtest/__init__.py`, `app/backtest/metrics.py`, `tests/test_backtest_metrics.py`
- `max_drawdown(equity: list[float]) -> float` (fração positiva, 0 se vazio).
- `round_trips(fills: list[Order]) -> list[Trade]` com preço médio; `Trade(pnl, fees, opened, closed, reason)`.
- `compute_metrics(initial_cash, equity, trades, fees_paid, slippage_paid, asset_return, index_return) -> Metrics`.
- `verdict(metrics, period_days, *, max_dd, min_trades) -> Verdict(passed: bool, checks: list[Check])` com as checagens: período ≥ 730 dias; bate o ativo; bate o índice (sem dados → `ok=None`, não reprova); drawdown ≤ teto; ≥ `min_trades` operações (`CANDIDATE_MIN_TRADES`, padrão 20); fator de lucro > 1.
- Testes com números feitos à mão (drawdown de [100,120,90,130] = 0,25; dois trades com ganho/perda conhecidos; fator de lucro sem perdas = `None` + checagem ok).

### Task 3: Migração 0005 + runner
**Files:** `migrations/versions/0005_backtests.py`, `app/db/models.py`, `app/office/accounts.py`, `app/backtest/runner.py`, `app/config.py`, `.env.example`, `tests/test_backtest_runner.py`
- Tabela `backtests(run_id PK, robot_id idx, start_ts, end_ts, created_ts, result_json)`.
- `AccountRegistry.new_backtest_run(robot, now) -> str` (`mode="backtest"`, id `bt-<robot>-<hash8>-<ts>`).
- `async run_backtest(ctx, robot, start, end) -> dict`: valida; carrega candles de `start - LOOKBACK` até `end` uma vez; para cada `decision_times(interval, start, end)` fatia a janela igual à do ao vivo e chama `decide_step(..., emit=False)` com `office_risk=AllowAll()`; cede o loop a cada passo; fecha a execução; calcula métricas, benchmarks e veredito; grava em `backtests`.
- Testes: período válido gera execução `backtest` com equity por dia e não cria execução `live`; robô espião nunca vê candle com `available_at > instante`; `mesa_ia` → `ValueError`; período inválido → `ValueError`; conta ao vivo intocada.

### Task 4: API
**Files:** `app/office/routes.py`, `tests/test_api_backtest.py`
- `POST /api/robots/{id}/backtest` `{start?: date, end?: date}` (padrão: últimos 2 anos até hoje) → resultado; 400 (mesa_ia/período), 404, 409 (outro backtest rodando).
- `GET /api/robots/{id}/backtests` → resumos (mais recente primeiro, 20).
- `GET /api/backtests/{run_id}` → resultado + `equity_curve` + `benchmark_curve` + ordens.
- Teste: P&L do prédio não muda depois de um backtest.

### Task 5: Painel de backtest
**Files:** `frontend/src/api/client.ts`, `frontend/src/panels/backtest.ts`, `frontend/src/panels/backtest.test.ts`, `frontend/src/panels/BacktestPanel.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- Escolher robô de regras + período (1/2/3 anos), "Rodar backtest", métricas, checklist do veredito, curva robô × buy-and-hold, histórico clicável, avisos.
- Funções puras testadas: `periodRange(years, today)`, `checkLabel(ok)`.

### Task 6: Docs + verificação real
- `docs/PROGRESSO.md`, `README.md` (endpoints), `CLAUDE.md` (variáveis novas).
- Rodar um backtest de 2 anos com yfinance real para um robô e conferir no navegador.
