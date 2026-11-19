# Escritório de Pregão — Etapas 0 a 2 (fundação multi-robô) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o sistema de "uma carteira e uma equipe de agentes" em um escritório com vários robôs, cada um com conta simulada própria, estratégia em código, risco por robô e do escritório, rodando sozinho no horário da B3 e recuperando candles perdidos — começando pela sala de Ações.

**Architecture:** Mesmo backend FastAPI + SQLite (abordagem A do design). Entram: configuração do escritório em YAML (`backend/office.yaml`), migrações Alembic, tabela de execuções (`runs`) que dá a cada robô uma conta (`account_id = run_id`), estratégias puras em `app/strategies/`, motor isolado em `app/engine/` (passo de decisão, recuperação de candles, risco do escritório, agendador APScheduler). A Mesa IA atual vira o robô `mesa-ia` com conta própria.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy Core 2.1, SQLite (WAL), Alembic, APScheduler 3.x (`AsyncIOScheduler`), exchange-calendars (calendário `BVMF`), PyYAML, pandas/numpy, pytest. Frontend React/TS só recebe uma tabela de robôs nesta fase (o 3D novo é a Etapa 4, outro plano).

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md`

## Global Constraints

- Regras invioláveis 1–7 do `CLAUDE.md` valem em todas as tarefas: somente paper trading; nada de opções binárias; sem promessa de lucro; indicadores em código; **nada com timestamp > instante simulado**; segredos só no `.env`; assets próprios/livres.
- Decisão mínima por candle de **1h**; robôs de Ações usam **1d por padrão**.
- Limite do escritório ou pausa: **só bloqueia ordens novas**; posições e stops continuam. "Dia" = **meia-noite de Brasília** (`America/Sao_Paulo`).
- Mudança de configuração do robô (hash) **abre novo `run_id`** com conta nova.
- Backend desligado: ao religar, **recupera candles perdidos em ordem**, idempotente (o mesmo candle nunca decide duas vezes).
- Capital inicial padrão por robô de Ações: **R$ 100.000**.
- Mesa IA: único robô com LLM; continua `LLM_PROVIDER=mock` nesta fase.
- Sem commits: o dono faz os próprios. Cada "Commit" do template vira **"rodar suíte + atualizar `docs/PROGRESSO.md`"**.
- Comentários e textos de UI em português; nomes de código em inglês.
- Comandos: `UV=/c/Users/leonardoaa/AppData/Local/Microsoft/WinGet/Links/uv.exe`; backend em `layout/sistema-financeiro/backend`: `$UV run pytest -q`, `$UV run ruff check .`, `$UV run black --check .`; frontend: `npm test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## Review Focus

1. **Recuperação após dias desligado** (ex.: fim de semana + feriado): deve processar só pregões válidos do calendário BVMF, em ordem, sem decidir duas vezes no mesmo candle → teste em Task 10.
2. **Robô com dados insuficientes** (ticker novo, < 50 candles): a estratégia devolve `ESPERA` com motivo, nunca exceção → teste em Task 8.
3. **YAML inválido ou robô duplicado**: o backend não sobe com config ruim e diz qual campo → teste em Task 6.
4. **Dois robôs no mesmo ticker**: contas e P&L totalmente separados; a exposição somada do escritório respeita o limite por instrumento → teste em Task 11.
5. **Banco antigo (Fases 1–4) já existente**: a migração adota as tabelas e move ordens antigas para a conta do `mesa-ia`, sem perder histórico → teste em Task 4/7.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `backend/app/data/prices.py` (mod) | não gravar candle incompleto (DATA-001) |
| `backend/app/cycle.py` (mod) | `assert_no_future` por `available_at`; Mesa IA usa a conta do robô |
| `backend/app/events.py` (mod) | publish tolerante a falha do recorder (ARCH-001); campos opcionais `room`, `robot_id` no envelope |
| `backend/app/main.py` (mod) | Host/Origin (SEC-001); lifespan com agendador; rotas do escritório |
| `backend/app/db/models.py` (mod) | PRAGMAs WAL/busy_timeout; tabelas `runs`, `robot_cursor`, `office_state`; `account_id` em `orders`, `equity_history`, `broker_cursor` |
| `backend/app/db/migrate.py` (novo) | `upgrade(engine)` via Alembic, com adoção de banco antigo |
| `backend/alembic.ini`, `backend/migrations/` (novos) | Alembic |
| `backend/office.yaml` (novo) | salas e robôs |
| `backend/app/office/config.py` (novo) | modelos Pydantic da config + carga + hash |
| `backend/app/office/accounts.py` (novo) | execuções/contas por robô |
| `backend/app/broker/paper.py` (mod) | tudo filtrado por `account_id` |
| `backend/app/strategies/` (novo) | `base.py` + 4 estratégias puras |
| `backend/app/engine/step.py` (novo) | um passo de decisão de um robô |
| `backend/app/engine/catchup.py` (novo) | candles a processar desde o cursor (calendário) |
| `backend/app/engine/office_risk.py` (novo) | risco do escritório (Gerente Geral) |
| `backend/app/engine/scheduler.py` (novo) | APScheduler |
| `frontend/src/panels/RobotsPanel.tsx` (novo) + `api/client.ts` (mod) | tabela de robôs e P&L |
| `CLAUDE.md`, `README.md`, `docs/PROGRESSO.md` (mod) | escopo novo e achados de doc |

---

## Etapa 0 — Correções da auditoria

### Task 1: Candle incompleto nunca é gravado (DATA-001)

**Files:** Modify `backend/app/data/prices.py` (`PriceStore._save`, `_refresh_if_needed`), `backend/app/cycle.py` (`assert_no_future`); Test `backend/tests/test_prices.py`, `backend/tests/test_cycle.py`

**Interfaces:**
- Produces: `PriceStore._save(ticker, interval, df, fetched_at: datetime) -> None` (descarta linhas com `available_at(ts) > fetched_at`); `assert_no_future(state, now)` compara `available_at(last_candle.time, interval)` com `now` (state ganha `interval`, padrão `"1d"`).

- [ ] **Step 1:** Testes que falham:
  - `test_candle_parcial_nao_e_gravado`: wall clock 18/11 15:48; fake devolve candles até 18/11 → consultar com `until=18/11 18:30` e wall clock avançado só 5 min (dentro do TTL): último candle é **17/11**.
  - `test_candle_parcial_e_substituido_depois_do_fechamento`: wall clock 18/11 19:00, TTL expirado → candle de 18/11 aparece.
  - `test_assert_no_future_usa_disponibilidade`: candle diário com `time = 18/11 00:00` e `now = 18/11 14:00` → `LookAheadError`.
- [ ] **Step 2:** `$UV run pytest -q tests/test_prices.py tests/test_cycle.py` → FAIL nos 3.
- [ ] **Step 3:** Implementar. Em `_save`, filtrar `available_at(ts, interval) <= fetched_at`, onde `fetched_at = datetime.fromtimestamp(now_wall, TZ_BRASILIA)`.
- [ ] **Step 4:** Suíte completa verde.

### Task 2: Falha ao gravar evento não trava o ciclo (ARCH-001)

**Files:** Modify `backend/app/events.py` (`EventBus.publish`); Test `backend/tests/test_events.py`

- [ ] **Step 1:** `test_recorder_que_falha_nao_impede_entrega`: recorder lança `RuntimeError` → o evento chega à fila do inscrito, e o erro vai para o log (`caplog`).
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Envolver a chamada do recorder em `try/except Exception` com `log.exception`.
- [ ] **Step 4:** Verde.

### Task 3: Validação de Host e Origin (SEC-001, INF-002)

**Files:** Modify `backend/app/main.py`, `backend/app/config.py` (novo campo `allowed_hosts: list[str] = ["localhost", "127.0.0.1"]`, CSV no `.env`), `.env.example`; Test `backend/tests/test_api.py`

- [ ] **Step 1:** Testes:
  - `test_host_desconhecido_e_recusado` (header `Host: evil.com` → 400);
  - `test_ws_origin_desconhecida_e_recusada` (`websocket_connect("/ws", headers={"origin": "http://evil.com"})` → `WebSocketDisconnect` com código 1008);
  - `test_ws_sem_origin_e_aceito` (clientes locais/CLI).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `TrustedHostMiddleware(allowed_hosts=settings.allowed_hosts + ["testserver"])`. No `/ws`, antes do `accept`: se houver `Origin` e ela não estiver em `settings.cors_origins`, fechar com 1008.
- [ ] **Step 4:** Verde.

### Task 4: SQLite robusto + Alembic com adoção do banco antigo (DATA-007, DATA-009, ARCH-003 parcial)

**Files:** Modify `backend/app/db/models.py` (`make_engine` deixa de chamar `create_all` para URL de arquivo); Create `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/versions/0001_baseline.py`, `backend/app/db/migrate.py`; Test `backend/tests/test_migrate.py`

**Interfaces:**
- Produces: `upgrade(engine: Engine) -> None` em `app/db/migrate.py`:
  - banco sem `alembic_version` mas com tabela `orders` → `stamp 0001` e depois `upgrade head`;
  - banco vazio → `upgrade head`;
  - `sqlite://` (memória) → `metadata.create_all` (testes).
- Produces: PRAGMAs em toda conexão de arquivo: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON` (listener `connect`).

- [ ] **Step 1:** Testes:
  - `test_banco_novo_chega_na_versao_head` (arquivo em `tmp_path`, tabelas existem, `alembic_version` = head);
  - `test_banco_antigo_e_adotado_sem_perder_dados` (cria o schema da Fase 3 com `metadata` antigo e 1 ordem → `upgrade` → ordem preservada);
  - `test_wal_ativo` (`PRAGMA journal_mode` = `wal`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:**
  - `$UV add alembic`.
  - `0001_baseline` cria exatamente as tabelas atuais de `models.py`.
  - `env.py` usa `app.db.models.metadata` e aceita conexão passada via `config.attributes["connection"]`.
- [ ] **Step 4:** Suíte completa verde (testes antigos usam `sqlite://`).

### Task 5: Documentação do novo escopo (DOC-H01..H03, DOC-M01..M06, DOC-L03)

**Files:** Modify `CLAUDE.md`, `README.md:3`, `docs/PROGRESSO.md`

- [ ] **Step 1:** No `CLAUDE.md`:
  - **§1:** prédio com 3 salas (Ações, Cripto, Minicontratos) e vários robôs; Mesa IA = robô.
  - **§2 regra 2:** mantida e citando que as binárias foram substituídas por minicontratos.
  - **§4:** Python **3.12**, Alembic, APScheduler, exchange-calendars, ccxt (futuro), **oxlint**.
  - **§5:** árvore real de pastas, com módulos futuros marcados "(Etapa N)".
  - **§6:** os agentes recebem dados pré-buscados pelo ciclo, não usam tool calling.
  - **§8:** contrato WS atual (`order_filled` com `ticker/reason/time`, `portfolio_update` com `initial_cash/stop/mark/pnl`, campos opcionais `room/robot_id`).
  - **§10:** agendado = APScheduler (Etapa 2).
  - **§12:** `CORS_ORIGINS`, `ALLOWED_HOSTS`, `OFFICE_CONFIG`.
  - **Tamanho:** enxugar trechos que só repetem o PROGRESSO, mantendo regras e contratos (sem cortar regras invioláveis).
- [ ] **Step 2:** `README.md:3` "pixel art" → "3D isométrico".
- [ ] **Step 3:** PROGRESSO: seção "Etapa 0" com o que foi corrigido.

---

## Etapa 1 — Domínio multi-robô

### Task 6: Configuração do escritório em YAML

**Files:** Create `backend/office.yaml`, `backend/app/office/__init__.py`, `backend/app/office/config.py`; Modify `backend/app/config.py` (`office_config: str = "office.yaml"`); Test `backend/tests/test_office_config.py`

**Interfaces:**
- Produces (Pydantic, `extra="forbid"`):
  - `StrategySpec(kind: Literal["sma_cross","rsi_reversion","donchian","atr_trend","mesa_ia"], params: dict[str, float] = {})`;
  - `RobotConfig(id: str (slug), name: str, room: Literal["acoes"], ticker: str, interval: Literal["1d","1h"] = "1d", strategy: StrategySpec, initial_cash: Decimal = 100000, enabled: bool = True, look: dict[str,str] = {})`;
  - `RoomConfig(id: Literal["acoes"], name: str, max_daily_loss: Decimal = 0.03, max_instrument_exposure: Decimal = 0.40)`;
  - `OfficeConfig(rooms: list[RoomConfig], robots: list[RobotConfig], building_max_daily_loss: Decimal = 0.03)`.
- Produces: `load_office(path: Path) -> OfficeConfig` (valida ids únicos; ticker ∈ `settings.tickers`); `RobotConfig.config_hash() -> str` (sha256 do JSON canônico de `strategy`, `ticker`, `interval`, `initial_cash`; **sem** `name`/`look`/`enabled`).
- `office.yaml` inicial (sala `acoes`): `atlas` (sma_cross, PETR4.SA), `orion` (rsi_reversion, VALE3.SA), `vega` (donchian, ITUB4.SA), `rigel` (atr_trend, PETR4.SA), `mesa-ia` (mesa_ia, PETR4.SA).

- [ ] **Step 1:** Testes:
  - `test_carrega_office_padrao` (5 robôs);
  - `test_id_duplicado_falha` (mensagem cita o id);
  - `test_ticker_fora_da_lista_falha`;
  - `test_hash_muda_com_parametro_e_nao_com_nome`.
- [ ] **Step 2:** FAIL. **Step 3:** `$UV add pyyaml`, implementar. **Step 4:** verde.

### Task 7: Execuções/contas por robô e PaperBroker por conta

**Files:** Modify `backend/app/db/models.py` (tabela `runs`: `id` str PK, `robot_id`, `mode` `live|backtest`, `config_hash`, `initial_cash` float, `started_ts`, `ended_ts` null; coluna `account_id` str NOT NULL em `orders`, `equity_history` (PK vira `account_id, ts`), `broker_cursor` (PK vira `account_id, ticker`)); Create `backend/migrations/versions/0002_accounts.py`, `backend/app/office/accounts.py`; Modify `backend/app/broker/paper.py`, `backend/app/broker/base.py` (`create_broker(settings, engine, account_id, initial_cash)`); Test `backend/tests/test_accounts.py`, `backend/tests/test_paper_broker.py`, `backend/tests/test_migrate.py`

**Interfaces:**
- Produces: `AccountRegistry(engine)` com:
  - `live_run(robot: RobotConfig, now: datetime) -> str` (devolve o run `live` aberto com o mesmo `config_hash`; se o hash mudou, fecha o antigo (`ended_ts`) e cria outro);
  - `broker_for(run_id: str) -> PaperBroker` (cache por run).
- Produces: `PaperBroker(engine, account_id: str, initial_cash, fee_pct, slippage_pct)`. Toda leitura e escrita filtra `account_id`.
- Migração `0002`: cria `runs`, adiciona as colunas e move dados antigos para o run `legacy-mesa-ia` (robot `mesa-ia`, `config_hash = "legacy"`).

- [ ] **Step 1:** Testes:
  - `test_dois_robos_mesmo_ticker_contas_separadas`;
  - `test_hash_novo_abre_run_novo_e_fecha_antigo`;
  - `test_mesmo_hash_reaproveita_run`;
  - `test_migracao_move_ordens_antigas_para_legacy` (em `test_migrate.py`).
  - Os testes atuais do PaperBroker passam com `account_id="t"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde.

---

## Etapa 2 — Estratégias, motor, risco do escritório, agendador

### Task 8: Estratégias puras

**Files:** Create `backend/app/strategies/__init__.py`, `base.py`, `sma_cross.py`, `rsi_reversion.py`, `donchian.py`, `atr_trend.py`; Test `backend/tests/test_strategies.py`

**Interfaces:**
- Produces: `Signal(action: Literal["COMPRA","VENDA","ESPERA"], reason: str)` (dataclass frozen).
- Produces: `Strategy` Protocol `decide(candles: pd.DataFrame, position_qty: int) -> Signal`.
- Produces: `build_strategy(spec: StrategySpec) -> Strategy` (`mesa_ia` → `ValueError`, porque é tratada pelo motor).
- Defaults:
  - `sma_cross(fast=9, slow=21)`: compra no cruzamento para cima sem posição; vende no cruzamento para baixo com posição;
  - `rsi_reversion(period=14, buy_below=30, sell_above=55)`;
  - `donchian(entry=20, exit=10)`: compra no rompimento da máxima de 20 (excluindo o candle atual); vende abaixo da mínima de 10;
  - `atr_trend(sma=50, atr=14, mult=3)`: compra com close > SMA50 sem posição; vende se close < máxima desde a entrada − 3×ATR, com aproximação pela máxima dos últimos 20 candles.
- Indicadores vêm de `app/indicators/technical.py` (regra 4).

- **Regras adaptadas do "Trader skill v2"** (Jake Schincariol, MIT, github.com/Jakeschincariol/day-trader-skill). Crédito no topo de `strategies/exits.py`. As skills não são instaladas: são só para EUA e a `trader-broker` envia ordem real.
  - **Estratégias novas:**
    - `bull_flag(rise=0.10, lookback=10, flag=5, band=0.05)`: alta > 10% nos 10 pregões antes dos últimos 5, e os últimos 5 fechamentos numa faixa < 5% → compra no rompimento da máxima da bandeira;
    - `ma20_reclaim`: fechamento volta acima da MM20 depois de fechar abaixo;
    - `oversold_bounce`: IFR(14) < 30 ontem e fechamento em alta hoje.
  - **`strategies/exits.py`:** `ExitPlan(stop: float, target: float)` e `plan_exit(entry, atr, mode="atr", atr_mult=2.0, r_multiple=2.0) -> ExitPlan`.
    - Alvo = entrada + R × risco.
    - Recusa (`ValueError`) se stop ≥ entrada, alvo ≤ entrada ou risco < 0,05% do preço.
    - O stop nunca é afastado depois da entrada; o broker só aceita `stop` igual ou mais alto.
  - **Risco por robô (Task 9):**
    - `max_trades_per_day` (padrão 3);
    - filtro de liquidez `min_avg_volume` (média de 20 candles, padrão 1.000.000);
    - preço de referência para dimensionar = máximo entre o preço planejado e o último fechamento;
    - **saídas (stop/alvo/venda) nunca são bloqueadas** por limite diário nem pelo escritório.
  - `kind` do `StrategySpec` ganha `bull_flag`, `ma20_reclaim` e `oversold_bounce`. O `office.yaml` ganha o robô `nova` (bull_flag, VALE3.SA).

- [ ] **Step 1:** Para cada estratégia, 3 testes com séries sintéticas: sinal de compra, sinal de venda, e **`test_<nome>_poucos_candles_espera`** (< mínimo → `ESPERA`, motivo cita "candles insuficientes"). Mais:
  - `test_build_strategy_desconhecida`;
  - `test_plan_exit_alvo_2r`;
  - `test_plan_exit_recusa_stop_acima_da_entrada`;
  - `test_plan_exit_recusa_risco_minusculo`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde.

### Task 9: Passo de decisão de um robô

**Files:** Create `backend/app/engine/__init__.py`, `backend/app/engine/step.py`; Test `backend/tests/test_engine_step.py`

**Interfaces:**
- Consumes: `PriceStore.get_candles`, `AccountRegistry`, `build_strategy`, `evaluate_risk`/`RiskLimits` (`agents/risk_rules.py`), `OfficeRisk.allows_new_orders` (Task 11).
- Produces: `async def robot_step(ctx: EngineContext, robot: RobotConfig, at: datetime) -> StepResult`.
  - Processa o mercado da conta (fills/stops com candles completos até `at`).
  - Calcula o sinal **só com candles com `available_at ≤ at`**.
  - Aplica o risco do robô e o do escritório.
  - Envia a ordem (execução no próximo candle).
  - Grava `equity_history`.
  - Emite eventos com `room` e `robot_id`.
- Produces: `StepResult(robot_id, run_id, candle_ts, signal, order_id | None, blocked_reason | None)`.
- Produces: `EngineContext(settings, prices, accounts, office_risk, bus, clock, office: OfficeConfig)`.
- `mesa_ia`: delega ao `CycleRunner` existente, usando o broker do run do robô.

- [ ] **Step 1:** Testes (com `FakePrices` em `tests/fakes.py`):
  - `test_step_compra_em_alta_cria_ordem_pendente`;
  - `test_step_nunca_ve_candle_futuro` (spy na estratégia: `max(available_at) <= at`);
  - `test_step_bloqueado_pelo_escritorio_nao_cria_ordem_mas_processa_stops`;
  - `test_eventos_tem_room_e_robot_id`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `events.make_event(type_, cycle_id, payload, room=None, robot_id=None)`, com os campos novos opcionais no envelope e espelhados em `frontend/src/ws/types.ts`. **Step 4:** verde.

### Task 10: Recuperação de candles perdidos (idempotente)

**Files:** Create `backend/app/engine/catchup.py`; Modify `backend/app/db/models.py` + `migrations/versions/0003_robot_cursor.py` (tabela `robot_cursor(run_id PK, last_decision_ts int)`); Test `backend/tests/test_catchup.py`

**Interfaces:**
- Produces: `decision_times(interval, since: datetime, until: datetime, calendar="BVMF") -> list[datetime]`.
  - `1d`: 18:00 BRT de cada pregão válido.
  - `1h`: o fechamento de cada hora de pregão.
  - Via `exchange_calendars.get_calendar("BVMF")`.
- Produces: `async def catch_up(ctx, robot, now) -> list[StepResult]`. Roda `robot_step` para cada horário depois do cursor e até `now`, **atualizando o cursor na mesma transação do passo**.
- Primeiro start sem cursor: começa no último horário de decisão (não roda o histórico; histórico é backtest).

- [ ] **Step 1:** Testes:
  - `test_decision_times_pula_fim_de_semana_e_feriado` (inclui 20/11/2026, Consciência Negra, se o calendário BVMF o marcar; senão, outro feriado conhecido do calendário);
  - `test_catch_up_processa_em_ordem`;
  - `test_catch_up_duas_vezes_nao_decide_de_novo`;
  - `test_primeiro_start_nao_roda_historico`.
- [ ] **Step 2:** FAIL. **Step 3:** `$UV add exchange-calendars` e implementar. **Step 4:** verde.

### Task 11: Risco do escritório (Gerente Geral)

**Files:** Create `backend/app/engine/office_risk.py`; Modify `backend/app/db/models.py` + `migrations/versions/0004_office_state.py` (tabela `office_state(scope PK, paused bool, reason, until_ts)`); Test `backend/tests/test_office_risk.py`

**Interfaces:**
- Produces: `OfficeRisk(engine, office: OfficeConfig, accounts: AccountRegistry)`:
  - `allows_new_orders(room, ticker, at, extra_exposure) -> tuple[bool, str | None]`;
  - `pause(scope: "building" | room_id, reason)`;
  - `resume(scope)`.
- Bloqueia se:
  - perda do dia da sala ≥ `room.max_daily_loss`;
  - perda do prédio ≥ `building_max_daily_loss`;
  - sala ou prédio pausado;
  - exposição somada no ticker (todos os robôs da sala) + nova > `max_instrument_exposure` × patrimônio da sala.
- Pausa por limite expira à **meia-noite BRT**; pausa manual só por `resume`.

- [ ] **Step 1:** Testes:
  - `test_perda_da_sala_bloqueia_ate_meia_noite`;
  - `test_pausa_manual_persiste_ate_resume`;
  - `test_exposicao_somada_de_dois_robos_bloqueia`;
  - `test_limite_nao_zera_posicoes` (posição e stop continuam no broker).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde.

### Task 12: Agendador + lifespan

**Files:** Create `backend/app/engine/scheduler.py`; Modify `backend/app/main.py` (`lifespan`: `upgrade(engine)`, `catch_up` de todos os robôs, inicia o agendador; `create_app(..., start_scheduler: bool = True)`; `uvicorn app.main:create_app --factory` no README/CLAUDE.md, ARCH-004); Test `backend/tests/test_scheduler.py`

**Interfaces:**
- Produces: `build_scheduler(ctx) -> AsyncIOScheduler`. Um job por robô habilitado: `CronTrigger` em `America/Sao_Paulo`.
  - `1d`: seg–sex 18:05.
  - `1h`: seg–sex, minuto 5, horas 11–18.
  - Cada job chama `catch_up(ctx, robot, clock.now())`, o que já ignora dias sem pregão.
- `max_instances=1` e `coalesce=True` por job.

- [ ] **Step 1:** Testes:
  - `test_um_job_por_robo_habilitado`;
  - `test_robo_desabilitado_sem_job`;
  - `test_app_de_teste_nao_inicia_agendador` (`start_scheduler=False`).
- [ ] **Step 2:** FAIL. **Step 3:** `$UV add "apscheduler<4"` e implementar. **Step 4:** verde.

### Task 13: API do escritório + tabela de robôs no frontend

**Files:** Modify `backend/app/main.py`; Create `frontend/src/panels/RobotsPanel.tsx`; Modify `frontend/src/api/client.ts`, `frontend/src/App.tsx`, `frontend/src/ws/types.ts`; Test `backend/tests/test_api_office.py`, `frontend/src/panels/robots.test.ts`

**Interfaces:**
- Produces REST:
  - `GET /api/building` → `{rooms:[{id,name,equity,day_pnl,day_pnl_pct,paused,reason}], equity, day_pnl}`;
  - `GET /api/rooms/{room}/robots` → `[{id,name,strategy,ticker,run_id,equity,initial_cash,pnl,pnl_pct,day_pnl,open_qty,last_signal,last_reason,last_decision_ts,enabled}]`;
  - `GET /api/robots/{id}` → robô + `orders` + `equity_curve`;
  - `POST /api/robots/{id}/pause|resume`;
  - `POST /api/rooms/{room}/pause|resume`.
- Rotas de ciclo atuais continuam (a Mesa IA usa o run do `mesa-ia`).
- Frontend: `RobotsPanel` mostra a tabela (nome, estratégia, ativo, P&L total e do dia em verde/vermelho, último sinal e motivo, status), recarregada a cada evento com `robot_id`. Função pura `sortRobots(rows, by)` testada.

- [ ] **Step 1:** Testes backend:
  - `test_building_soma_salas`;
  - `test_robots_da_sala_com_pnl`;
  - `test_pause_resume_sala`;
  - `test_robo_inexistente_404`.
  - Frontend: `sortRobots` por P&L.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** suíte completa backend + frontend (testes, ruff, black, oxlint, tsc, build) verde.
- [ ] **Step 5:** Verificação manual:
  - subir com `--factory`;
  - conferir em `/api/building` e na tabela os 5 robôs com conta própria;
  - disparar `POST /api/cycle` (Mesa IA) e ver só o P&L do `mesa-ia` mudar.
- [ ] **Step 6:** Atualizar `docs/PROGRESSO.md` (Etapas 0–2, tecnologias novas com versão, decisões) e `README.md` (como rodar com `--factory`, `office.yaml`).

---

## Próximos planos (fora deste)

- Etapa 3 — backtest por robô e métricas (`run_id` mode `backtest`, tela de resultados). Incluir o **veredito do Trader skill v2**:
  - taxa de "alvo primeiro" precisa superar 1/(1+R) (50% em 1R, 33% em 2R) por mais de 5 pontos; abaixo disso, "cara ou coroa";
  - opcional: Monte Carlo por reamostragem de barras (10.000 simulações, semente fixa);
  - **com custos e slippage**, que o original não modela.
- Etapa 4 — escritório 3D v2 (HUD, andares, CEO, Gerente Geral, operadores, bloom, painel do robô).
- Etapas 5–8 — Minicontratos, Cripto, Mesa IA com LLM real, polimento.
