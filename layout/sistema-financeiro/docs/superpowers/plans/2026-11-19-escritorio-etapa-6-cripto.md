# Escritório — Etapa 6: Sala de Cripto — Plano

> Execução: superpowers:executing-plans (inline). Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** abrir o andar **Criptomoedas** com 4 robôs em **BTC, ETH e SOL**, conta de **20 mil dólares** cada, **quantidade fracionária**, mercado **24/7**, só comprado, e o prédio somando tudo em **reais** pela cotação do dólar **do instante** (sem look-ahead). Sempre paper trading.

**Architecture:** os preços vêm do **yfinance** (`BTC-USD`, `ETH-USD`, `SOL-USD`), que já está instalado e só lê dados. A conta de cripto é um `PaperBroker` com **passo de quantidade** fracionário (`CryptoBroker`). Taxa e slippage passam a poder ser definidas por sala. A sala ganha **moeda** (`BRL`/`USD`) e **calendário** (`B3`/`24x7`): decisões de cripto todo dia às 21:05 (o candle diário de cripto fecha às 21h de Brasília). Valores em dólar são convertidos para reais só na soma do prédio, com o último `USDBRL=X` **completo** no instante.

**Tech Stack:** o que já existe (yfinance, exchange-calendars, APScheduler). **Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` §6.3 (Cripto), §7 (4 robôs, 20 mil USDT), §8 (agendador 24/7), §11 (andar).

## Desvio do spec (decisão registrada)
O spec previa `ccxt` (Binance, pares USDT). A regra do dono nesta sessão é **não instalar ferramentas de terceiros que enviem ordens reais**, e o `ccxt` é uma biblioteca de envio de ordens para exchanges. Usamos o yfinance (pares em **USD**, preço agregado, sem exchange específica). Custo: o preço não é o de uma exchange específica, e não há livro de ofertas; documentado na tela.

## Global Constraints
- Somente paper trading. Nenhuma chave de API. Nada de opções binárias.
- Cripto só comprado (sem short nesta etapa). Quantidade fracionária com passo configurável.
- Custos: taxa 0,1% + slippage configurável (sala).
- Moeda da conta: USD. Consolidado em BRL pela cotação `USDBRL=X` **disponível no instante** (regra 5); sem cotação → o prédio avisa e não inventa valor.
- 24/7: sem calendário da B3; candle diário completo 24h após a abertura (00:00 UTC = 21:00 de Brasília).
- Benchmark: comprar e segurar o próprio ativo e o BTC.
- Textos em português; aviso de limitação (preço agregado do yfinance, sem exchange específica).

## Review Focus
1. Candle diário de cripto marcado 21:00 de Brasília do dia anterior → decisão às 21:05 só vê o candle que fechou às 21:00 (Task 1: `is_24h("BTC-USD")`).
2. Prédio com sala em dólar: patrimônio total e perda do dia em reais com a cotação do instante; sem cotação → `fx_missing` e a sala fica fora da soma (Task 4).
3. Compra fracionária com caixa justo → quantidade arredondada para baixo no passo, nunca caixa negativo (Task 2).
4. Decisões 24/7 incluem sábado e domingo; robôs da B3 continuam só em dias úteis (Task 3).
5. Robô de ações e de minis não mudam (suíte inteira verde).

---

### Task 1: Configuração e dados
**Files:** `app/office/config.py`, `office.yaml`, `app/data/prices.py`, testes de config e preços
- `RoomConfig`: `currency: "BRL"|"USD" = "BRL"`, `calendar: "B3"|"24x7" = "B3"`, `assets: list[str] = []` (tickers aceitos na sala além de TICKERS), `fee_pct`/`slippage_pct`/`qty_step` opcionais.
- `RoomId` + `"cripto"`; `load_office`: ticker válido se em TICKERS, instrumento ou `room.assets`.
- `is_24h`: também tickers terminados em `-USD`.
- `office.yaml`: sala `cripto` (USD, 24x7, BTC-USD/ETH-USD/SOL-USD, taxa 0,1%, slippage 0,05%, passo 0,0001) + 4 robôs com `initial_cash: 20000`.

### Task 2: Conta com quantidade fracionária
**Files:** `app/broker/paper.py`, `app/agents/risk_rules.py`, `app/office/accounts.py`, testes
- `PaperBroker(..., qty_step=1.0)`: arredonda para baixo no passo ao ajustar por caixa (`_round_qty`). Coluna `qty` do SQLite guarda REAL (afinidade dinâmica) — migração 0006 muda o tipo no modelo para `Float`.
- `evaluate_risk(..., qty_step=1.0)`: arredonda no passo.
- `AccountRegistry`: parâmetros de corretora por robô (taxa, slippage, passo) vindos da sala.

### Task 3: Calendário 24/7 e agendador
**Files:** `app/engine/catchup.py`, `app/engine/scheduler.py`, testes
- `decision_times(interval, since, until, calendar)`: `"24x7"` → todo dia às 21:05 (1d) / toda hora no minuto 5 (1h).
- Agendador: robôs de sala 24x7 → `CronTrigger(hour=21, minute=5)` todos os dias (1d).
- `catch_up` usa o calendário da sala do robô.

### Task 4: Câmbio e soma do prédio
**Files:** `app/office/fx.py`, `app/engine/office_risk.py`, `app/office/routes.py`, testes
- `usd_brl(prices, at) -> float | None`: último fechamento completo de `USDBRL=X` em `at`.
- Sala ganha `currency`, `equity` (moeda da sala) e `equity_brl`; prédio soma em BRL e marca `fx_missing`.
- Perda do dia do prédio em BRL (mesma cotação no início e no fim do dia: mede o resultado dos robôs, não a variação do dólar).
- Linha do robô ganha `currency`.

### Task 5: Backtest de cripto
**Files:** `app/backtest/runner.py`, testes
- Calendário 24x7 nos horários; benchmark = comprar e segurar o ativo e o BTC (`BTC-USD`).

### Task 6: Frontend
**Files:** `frontend/src/office/office.ts(+test)`, `panels/*`, `room/floors/TradingFloor.tsx`, `room/screens.ts`, `room/Room3D.tsx`
- Andar Cripto habilitado; dinheiro formatado pela moeda (`signedMoney(v, currency)`); placas e telão em US$; HUD soma em R$ e avisa se faltar cotação; aviso de limitação no andar.

### Task 7: Docs e verificação real
- `PROGRESSO.md`, `CLAUDE.md`, `README.md`; suítes; passo real dos 4 robôs; backtest de 2 anos de um robô BTC; navegador.
