# CLAUDE.md — Sala de Operações com Agentes de IA (modo simulado)

> Este arquivo orienta o Claude (ou qualquer assistente de código) a construir e manter este projeto.
> Leia tudo antes de escrever código. Em caso de dúvida, siga as **Regras invioláveis**.

---

## 1. O que é o projeto

Uma aplicação web que mostra uma **"sala de operações" em 3D isométrico low-poly** onde "bonecos" representam agentes de IA trabalhando juntos:

- um **lendo notícias**,
- outro **analisando gráficos**,
- outro **avaliando risco**,
- e um **gestor/trader** que junta tudo e decide **COMPRA / VENDA / ESPERA**.

Por trás do visual existe um **sistema multiagente** (inspirado no framework open source *TradingAgents*, da Tauric Research) operando **apenas em modo simulado (paper trading)** com ações da **B3**.

**Objetivo:** aprendizado de arquitetura multiagente, orquestração de LLMs, WebSocket e visualização em tempo real.
**Não é objetivo:** ganhar dinheiro, operar conta real ou fazer opções binárias.

### Escritório de Pregão (evolução em andamento)
Além da equipe de agentes de IA, o projeto virou um **escritório de pregão**: vários robôs, cada um com **conta simulada própria** e P&L visível, organizados em salas: **Ações B3**, **Minicontratos B3** (WIN/WDO por proxy, com margem e venda a descoberto) e **Criptomoedas** (BTC/ETH/SOL pelo yfinance, contas em US$, 24/7, quantidade fracionária, só comprado), no lugar das opções binárias, que continuam proibidas pela regra 2. Cripto **não usa `ccxt`**: a regra do dono é não instalar ferramenta de terceiros que envie ordens reais. A equipe de IA é o robô `mesa-ia`. O dono é o CEO; o risco do escritório é o "Gerente Geral" (em código).
- Design: `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` · progresso: `docs/PROGRESSO.md`.
- Salas e robôs em `backend/office.yaml`; mudar estratégia/ativo/limites de um robô abre uma conta nova.
- Robôs de regras rodam **sem LLM** (estratégias em `app/strategies/`); limite atingido bloqueia só compras novas e mantém stops/alvos.

### Verdade importante (não esquecer)
Os bonecos são **teatro**: são uma visualização dos logs e eventos do backend. O visual **não melhora** o resultado financeiro. Toda decisão precisa ser rastreável em texto (log/banco), independentemente da animação.

---

## 2. Regras invioláveis

1. **Somente paper trading.** Nenhum código pode enviar ordens reais. A classe de corretora real (se um dia existir) fica atrás de `LIVE_TRADING_ENABLED=false` **e** exige confirmação manual explícita. Por padrão ela nem é implementada, apenas a interface.
2. **Nada de opções binárias.** Não integrar IQ Option, Quotex, Pocket Option, Binomo, Olymp Trade ou similares. Elas são proibidas pela CVM no Brasil, a casa é a contraparte e o preço é controlado pela plataforma. Se alguém pedir essa integração, **recusar** e explicar o motivo.
3. **Sem promessas de lucro.** Nenhuma tela, README ou texto pode dizer ou insinuar "lucro garantido", "robô que faz tudo sozinho" etc. Mostrar sempre um aviso: *"Simulação educacional. Não é recomendação de investimento."*
4. **Indicadores são calculados por código, não pelo LLM.** RSI, médias e volatilidade saem de pandas/numpy. O LLM só **interpreta** números já calculados. Ele nunca inventa preço.
5. **Sem vazamento de futuro (look-ahead).** Em qualquer simulação ou backtest, cada agente só recebe dados com timestamp **≤ instante simulado**.
6. **Segredos fora do código.** Chaves de API ficam apenas em `.env` (no `.gitignore`). Fornecer `.env.example` sem valores reais.
7. **Assets originais ou livres.** Modelos, texturas e fontes devem ser próprios (hoje: tudo montado com primitivas e desenhado em canvas) ou de licença livre (ex.: pacotes CC0 da Kenney/Quaternius). Nada de personagens, logotipos ou marcas protegidas.

---

## 3. Arquitetura

```
┌──────────────────────────── DADOS ────────────────────────────┐
│ Preços (candles) B3 → yfinance (tickers com ".SA")             │
│ Notícias → feeds RSS (feedparser)                              │
└───────────────────────────────┬───────────────────────────────┘
                                ↓
┌──────────────────── CÉREBRO (backend Python) ─────────────────┐
│ Orquestrador (LangGraph)                                       │
│   ├─ Agente Notícias  → sentimento por ticker (-1 a +1)        │
│   ├─ Agente Gráfico   → lê indicadores calculados, tendência   │
│   ├─ (opcional) Debate Otimista × Pessimista                   │
│   ├─ Agente Risco     → tamanho da posição, stop, veto         │
│   └─ Gestor/Trader    → decisão final COMPRA/VENDA/ESPERA      │
└───────────────────────────────┬───────────────────────────────┘
                                ↓
┌──────────────────────── EXECUÇÃO ─────────────────────────────┐
│ PaperBroker (simulado): carteira, ordens, P&L, custos          │
│ Interface Broker → implementação real NÃO incluída             │
└───────────────────────────────┬───────────────────────────────┘
                                ↓  eventos via WebSocket
┌──────────────────── FRONTEND (a "sala") ──────────────────────┐
│ React + Three.js (R3F): sala 3D, bonecos, balões, gráfico,     │
│ painel de carteira e linha do tempo de decisões                │
└───────────────────────────────────────────────────────────────┘
```

Cada **agente** = um LLM com: (a) um prompt de papel, (b) ferramentas específicas e (c) **saída estruturada em JSON** validada por Pydantic.

---

## 4. Stack

### Backend
- **Python 3.12** (instalado e gerenciado pelo uv)
- **FastAPI** + **uvicorn** (REST + WebSocket)
- **LangGraph** para orquestrar o fluxo entre agentes
- **Pydantic v2** para os schemas de entrada e saída dos agentes
- **pandas / numpy** para indicadores (implementação própria ou `pandas-ta`)
- **yfinance** para candles da B3 (`PETR4.SA`, `VALE3.SA`, `ITUB4.SA`, `BBDC4.SA`, `^BVSP`)
- **feedparser** para notícias (RSS de portais financeiros brasileiros e Google News RSS por termo)
- **SQLite** (SQLAlchemy Core, modo WAL) para decisões, ordens, eventos e cache; migrações com **Alembic** (`backend/migrations/`, aplicadas ao subir)
- **PyYAML** (`office.yaml`), **exchange-calendars** (calendário B3) e **APScheduler 3** (agendador dos robôs)
- **pytest** para testes
- Gerenciador de dependências: **uv** (ou pip + `requirements.txt`)

### LLM
- Camada de abstração `llm/provider.py` com implementações intercambiáveis:
  - `AnthropicProvider` (padrão, modelo configurável via `LLM_MODEL`)
  - `OpenAIProvider` (opcional)
  - `MockProvider`: respostas fixas e determinísticas, **sem custo**, usado em dev e nos testes
- `LLM_PROVIDER=mock` deve ser o padrão no `.env.example`.

### Frontend
- **Vite + React + TypeScript**
- **Three.js + React Three Fiber** para a sala 3D isométrica low-poly (câmera ortográfica). Etiquetas e balões são HTML por cima do canvas (`room/labelRegistry.ts`), sem `<Html>` do drei
- **lightweight-charts** (TradingView, open source) para o gráfico de candles
- **Zustand** para o estado global
- WebSocket nativo do navegador, com reconexão automática

---

## 5. Estrutura de pastas

```
trading-room/
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py              # FastAPI, rotas REST e WS
│   │   ├── config.py            # lê .env (pydantic-settings)
│   │   ├── events.py            # schema dos eventos + EventBus
│   │   ├── clock.py             # relógio real × relógio simulado (replay)
│   │   ├── data/
│   │   │   ├── prices.py        # yfinance + cache SQLite (candle de 24h para câmbio `=X`)
│   │   │   ├── instruments.py   # minicontratos: candles do proxy em pontos (WIN ≈ ^BVSP, WDO ≈ USDBRL=X × 1000)
│   │   │   └── news.py          # RSS + filtro por ticker/termos + cache
│   │   ├── indicators/
│   │   │   └── technical.py     # SMA, EMA, RSI, MACD, ATR, volatilidade
│   │   ├── llm/
│   │   │   ├── provider.py      # interface + Anthropic/OpenAI/Mock
│   │   │   └── budget.py        # contador de tokens e limite de custo
│   │   ├── agents/
│   │   │   ├── base.py          # classe Agent (prompt, tools, schema, emit)
│   │   │   ├── news_agent.py
│   │   │   ├── chart_agent.py
│   │   │   ├── debate_agents.py # otimista/pessimista (fase 5)
│   │   │   ├── risk_agent.py
│   │   │   ├── manager_agent.py
│   │   │   └── prompts/*.md     # prompts de papel, versionados
│   │   ├── graph/
│   │   │   └── workflow.py      # grafo LangGraph de um ciclo de decisão
│   │   ├── broker/
│   │   │   ├── base.py          # interface Broker
│   │   │   ├── paper.py         # PaperBroker (conta por account_id, stop e alvo)
│   │   │   └── futures.py       # FuturesBroker: pontos × multiplicador, margem, vendido, custo por contrato
│   │   ├── office/              # config.py (office.yaml) · accounts.py (conta por robô) · routes.py (API) · fx.py (USD→BRL)
│   │   ├── strategies/          # estratégias de regras puras + exits.py (stop ATR, alvo 2R, dos dois lados)
│   │   │                        # + sides.py (lado vendido = série espelhada; contratos por risco e margem)
│   │   ├── engine/              # step (passo do robô) · futures (passo de minicontratos) · common
│   │   │                        # · catchup · office_risk · scheduler
│   │   ├── backtest/
│   │   │   └── runner.py        # replay histórico sem look-ahead
│   │   └── db/
│   │       └── models.py
│   └── tests/
└── frontend/
    ├── package.json
    ├── public/assets/           # sprites, tiles e sons (licença livre)
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── ws/client.ts         # conexão WS + reconexão
        ├── store/useRoomStore.ts
        ├── office/              # escritório: office.ts (regras puras: andares, P&L fechado/aberto, placas, Gerente Geral)
        │                        # deskLayout.ts · useOfficeStore.ts (andar, robô selecionado) · useOfficeData.ts
        ├── room/
        │   ├── RoomCanvas.tsx   # carrega a cena 3D sob demanda (+ plano B sem WebGL)
        │   ├── Room3D.tsx       # Canvas R3F: luzes, câmera, bloom e andar escolhido
        │   ├── floors/          # TradingFloor (Ações) · AgentIsland (Mesa IA) · Boardroom (Diretoria) · Shell
        │   ├── effects.tsx      # câmera com zoom/arrastar limitados + bloom (three/examples)
        │   ├── screens.ts       # telas em canvas: mini-curva, telão da sala, telão da Diretoria
        │   ├── models3d.tsx     # mesa, monitor, cadeira, boneco articulado (careca/terno/óculos), placa PARE
        │   ├── director.ts      # evento WS → ação da sala (puro)
        │   ├── brain.ts         # máquina de estados do boneco (pura)
        │   ├── fx.ts            # estado dos efeitos (balões, luz, veto, terminal)
        │   ├── labelRegistry.ts # etiquetas HTML presas em pontos 3D
        │   └── layout3d.ts      # posição de cada mesa/boneco
        └── panels/
            ├── HUD.tsx          # barra do escritório: andares, patrimônio, hoje, Fechados|Abertos|Ambos
            ├── RobotsPanel.tsx  # tabela de robôs do andar (texto acessível do 3D)
            ├── RobotDetail.tsx  # painel lateral do robô clicado
            ├── PriceChart.tsx   # lightweight-charts
            ├── Portfolio.tsx
            ├── DecisionLog.tsx  # linha do tempo legível
            └── Controls.tsx     # ticker, rodar ciclo, replay, velocidade
```

---

## 6. Os agentes (detalhes)

Todos herdam de `agents/base.py`:
- recebem um **contexto** apenas com dados ≤ `clock.now()`;
- emitem eventos `agent_status` (`thinking` → `done`) e `agent_message`;
- retornam um objeto Pydantic validado. Se o JSON vier inválido, **uma** nova tentativa; se falhar de novo, retornar um resultado neutro e registrar o erro.

### 6.1 Agente Notícias ("o leitor")
- **Ferramentas:** `get_news(ticker, since, until)` → lista de manchetes com data e fonte.
- **Saída:**
  ```json
  {"ticker":"PETR4.SA","sentiment":0.35,"confidence":0.6,
   "key_points":["..."],"sources":["url1","url2"]}
  ```
- Sem notícias no período → `sentiment: 0`, `confidence: 0`.
- Nunca citar notícia que não veio da ferramenta.

### 6.2 Agente Gráfico ("o analista técnico")
- **Ferramentas:** `get_indicators(ticker, until)` → JSON com o último candle, SMA20/50, EMA9, RSI14, MACD, ATR14 e volatilidade de 20 dias, **todos calculados em código**.
- **Saída:**
  ```json
  {"ticker":"PETR4.SA","trend":"alta|baixa|lateral","signal":-1..1,
   "confidence":0..1,"reasoning":"texto curto citando os números recebidos"}
  ```

### 6.3 Debate Otimista × Pessimista (opcional, fase 5)
- Dois agentes leem as saídas 6.1 e 6.2 e argumentam a favor e contra, em no máximo **2 rodadas**.
- **Saída:** resumo dos argumentos de cada lado, para o Gestor.

### 6.4 Agente Risco ("o freio")
- **Entrada:** carteira atual, ATR, volatilidade e a proposta preliminar.
- **Regras em código (o LLM não pode violar):**
  - risco máximo por operação: `MAX_RISK_PER_TRADE` (padrão 1% do patrimônio);
  - exposição máxima por ativo: `MAX_POSITION_PCT` (padrão 20%);
  - stop sugerido = preço − `ATR_STOP_MULT` × ATR (padrão 2);
  - perda diária máxima `MAX_DAILY_LOSS` (padrão 3%): ao atingir, **veta tudo** até o próximo dia.
- **Saída:** `{"approved":bool,"max_qty":int,"stop":float,"notes":"..."}`

### 6.5 Gestor/Trader ("o decisor")
- **Entrada:** as saídas de todos os agentes anteriores.
- **Saída:**
  ```json
  {"action":"COMPRA|VENDA|ESPERA","ticker":"...","qty":int,
   "stop":float,"rationale":"justificativa curta"}
  ```
- Se o Risco não aprovou → força `ESPERA`.
- `qty` nunca pode passar de `max_qty`; validar em código e cortar se passar.
- A ordem só segue para o `PaperBroker` depois dessas validações.

### Fluxo do grafo (LangGraph)
```
start → [Notícias ∥ Gráfico] → (Debate?) → Gestor (proposta) → Risco → Gestor (final) → Broker → end
```
Notícias e Gráfico rodam **em paralelo**.

---

## 7. PaperBroker (simulação)

- Patrimônio inicial configurável: `INITIAL_CASH` (padrão R$ 100.000).
- Preço de execução: **abertura do próximo candle** (evita executar no preço que gerou o sinal).
- Custos simulados: `FEE_PCT` (padrão 0,03%) e slippage `SLIPPAGE_PCT` (padrão 0,05%).
- Lote: aceitar lote fracionário (1 ação) para simplificar e documentar isso.
- Stops checados a cada candle novo.
- Tudo persistido: ordens, posições, histórico de patrimônio.
- Métricas: retorno total, retorno do benchmark (buy-and-hold do mesmo ativo e do `^BVSP`), drawdown máximo, taxa de acerto, número de operações e **custo total de API do LLM**.

---

## 8. Eventos WebSocket (contrato backend ↔ frontend)

Endpoint: `ws://localhost:8000/ws`. Todo evento segue:

```json
{"type":"...","ts":"2026-11-18T14:00:00-03:00","cycle_id":"uuid","room":null,"robot_id":null,"payload":{}}
```

`room` e `robot_id` vêm preenchidos nos eventos dos robôs do escritório (motor em `app/engine/`); na equipe de IA ficam `null`. O frontend não deixa evento de robô mexer na sala/carteira da equipe de IA.

| type | payload | efeito na sala |
|---|---|---|
| `cycle_started` | `{ticker}` | luz da sala acende e os bonecos "acordam" |
| `agent_status` | `{agent, status: idle\|thinking\|done\|error}` | animação do boneco (digitando, lendo, parado) |
| `agent_message` | `{agent, text}` | balão de fala (máx. ~140 caracteres, texto completo no log) |
| `agent_result` | `{agent, result}` | atualiza o painel lateral |
| `decision` | `{action, ticker, qty, stop, rationale}` | Gestor anda até o "terminal" |
| `order_filled` | `{ticker, side, qty, price, fee, reason: decisao\|stop\|alvo, time}` | efeito no gráfico + som curto |
| `portfolio_update` | `{cash, positions, equity}` | painel de carteira |
| `price_update` | `{ticker, candle}` | gráfico |
| `risk_veto` | `{reason}` | boneco do Risco levanta a placa "PARE" |
| `budget_warning` | `{spent, limit}` | aviso de custo |
| `cycle_finished` | `{duration_ms, tokens, cost}` | bonecos voltam a `idle` |

Os schemas ficam em `backend/app/events.py` (Pydantic) e são espelhados em `frontend/src/ws/types.ts`. Manter os dois sincronizados; se possível, gerar os tipos TS a partir do JSON Schema.

---

## 9. A sala (frontend)

- **Escritório (Etapa 4):** HUD com andares (Diretoria, Ações B3; Minis e Cripto "em breve"), patrimônio do prédio, P&L do dia e alternador Fechados|Abertos|Ambos. No andar de Ações, **uma mesa por robô** (operador sentado, monitores com a mini-curva da conta, placa nome + P&L clicável), a **ilha da Mesa IA** e um telão com a curva de patrimônio da sala; filetes dourados com bloom; zoom/arrastar com limites. Na **Diretoria**, o CEO (careca, terno, óculos claros) e o Gerente Geral (terno, sem marca) com telão de andares e ranking. Clique abre o painel do robô; a tabela do andar repete tudo em texto.
- **Ilha da Mesa IA:** 4 mesas de agentes + terminal de ordens:
  - **Notícias:** mesa com jornal e monitor de manchetes. Anima "virando páginas".
  - **Gráfico:** mesa com vários monitores de candles. Anima "digitando" e "apontando".
  - **Risco:** mesa com balança/escudo. No veto, levanta a placa "PARE".
  - **Gestor:** mesa central com o "terminal de ordens". Na decisão, anda até ele.
  - (fase 5) **Otimista e Pessimista:** mesa de reunião, com balões alternados.
- **Modelos:** low-poly montados com primitivas (caixas, cilindros), sombras suaves, câmera ortográfica fixa. Nada de logotipos/marcas de terceiros na cena (ex.: referências visuais de outras salas não são copiadas).
- **Máquina de estados do boneco:** `idle → walking → working → talking → idle`, dirigida apenas pelos eventos WS.
- **Painéis:**
  - gráfico de candles com marcadores de compra/venda;
  - carteira (caixa, posições, patrimônio, P&L);
  - **DecisionLog:** linha do tempo com o raciocínio completo de cada agente, clicável. Essa é a fonte de verdade, não a animação;
  - controles: escolher ticker, "Rodar ciclo", modo **Replay** (data inicial e final, velocidade 1×/5×/20×), pausar.
- **Aviso fixo no rodapé:** "Simulação educacional. Não é recomendação de investimento."
- **Acessibilidade:** tudo que a animação mostra também aparece em texto no log.

---

## 10. Modos de execução

1. **Ciclo manual:** botão "Rodar ciclo" executa uma decisão com dados atuais.
2. **Agendado:** a cada `CYCLE_INTERVAL_MIN` (padrão 60 min) durante o pregão da B3 (10h–17h, horário de Brasília, dias úteis).
3. **Replay/backtest:** percorre candles diários (ou de 1h) entre duas datas usando `clock.py` simulado.
   - Notícias filtradas por data de publicação ≤ instante simulado.
   - **Limitação a documentar na interface:** o LLM pode "conhecer" eventos do período por causa do treinamento, o que infla o resultado do backtest. Mostrar esse aviso na tela de resultados.

> Não usar intervalos de segundos ou de 1 minuto. Um LLM leva segundos para responder, notícia não prevê o próximo minuto e o custo explode. O sistema é para decisões diárias ou horárias.

---

## 11. Controle de custo

- `llm/budget.py` soma tokens de entrada e saída por chamada e por ciclo, e converte em custo estimado (preços configuráveis no `.env`).
- `MAX_COST_PER_DAY` (padrão US$ 1,00): ao atingir, emite `budget_warning` e muda automaticamente para `MockProvider` ou pausa.
- Cache de respostas por hash de (agente + prompt + entrada), em SQLite.
- Prompts curtos, entradas resumidas (enviar indicadores e manchetes, nunca o histórico bruto).
- Mostrar o custo por ciclo no painel.

---

## 12. Variáveis de ambiente (`.env.example`)

```
LLM_PROVIDER=mock            # mock | anthropic | openai
LLM_MODEL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
PRICE_PER_MTOK_INPUT=
PRICE_PER_MTOK_OUTPUT=
MAX_COST_PER_DAY=1.00

TICKERS=PETR4.SA,VALE3.SA,ITUB4.SA
BENCHMARK=^BVSP
CYCLE_INTERVAL_MIN=60
NEWS_FEEDS=                  # URLs RSS separadas por vírgula

INITIAL_CASH=100000
FEE_PCT=0.0003
SLIPPAGE_PCT=0.0005
MAX_RISK_PER_TRADE=0.01
MAX_POSITION_PCT=0.20
MAX_DAILY_LOSS=0.03
ATR_STOP_MULT=2
CANDIDATE_MAX_DRAWDOWN=0.20  # backtest: drawdown máximo para "candidato"
CANDIDATE_MIN_TRADES=20      # backtest: mínimo de operações fechadas

LIVE_TRADING_ENABLED=false   # NÃO alterar. Não há broker real implementado.
DATABASE_URL=sqlite:///./trading_room.db
ALLOWED_HOSTS=localhost,127.0.0.1   # Host aceitos pelo backend (proteção DNS rebinding)
OFFICE_CONFIG=               # vazio = backend/office.yaml
```

---

## 13. Comandos

```bash
# Backend
cd backend
uv sync                         # ou: pip install -e .
uv run uvicorn app.main:create_app --factory --reload --port 8000
uv run pytest -q

# Frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173
npm run build
npm run lint
```

---

## 14. Plano de construção (fases)

Cada fase termina com testes passando e algo visível rodando.

1. **Fundação:** estrutura de pastas, config, FastAPI com `/health`, WebSocket que envia eventos fake e frontend que conecta e mostra os eventos em lista.
2. **Dados e indicadores:** `prices.py` com cache, `technical.py` com testes comparando valores conhecidos, `news.py` com RSS e cache, e gráfico de candles no frontend.
3. **Agentes com MockProvider:** os 4 agentes, schemas, grafo LangGraph e PaperBroker. O ciclo completo roda **sem custo**.
4. **A sala:** 3D isométrico (Three.js/R3F), 4 bonecos com estados de animação, mesas por ativo com P&L, balões de fala, painéis e DecisionLog.
5. **LLM real + debate:** `AnthropicProvider`, controle de orçamento, cache e agentes Otimista/Pessimista.
6. **Replay/backtest:** relógio simulado, métricas, comparação com benchmark e avisos de limitação.
7. **Polimento:** sons, velocidade de replay, exportar relatório do backtest em CSV e README com prints.

---

## 15. Testes obrigatórios

- Indicadores: valores conferidos contra cálculo manual numa série pequena.
- **Look-ahead:** teste que falha se algum agente receber candle ou notícia com timestamp > `clock.now()`.
- Risco: o Gestor nunca consegue ordem com `qty > max_qty` nem operar após `MAX_DAILY_LOSS`.
- PaperBroker: execução no próximo candle, taxas, slippage e stop.
- Agentes: JSON inválido do LLM → retry → resultado neutro.
- Contrato WS: todo evento emitido valida contra o schema.
- **Segurança:** teste que garante que nenhuma classe de broker real é instanciada com `LIVE_TRADING_ENABLED=false`.

---

## 16. Estilo de código

- Python: type hints em tudo, `ruff` + `black`, funções pequenas, sem lógica de negócio dentro de prompts.
- TypeScript: `strict: true`, oxlint e Prettier.
- Prompts em `agents/prompts/*.md`, versionados, sempre em português, pedindo **somente JSON** no formato do schema.
- Commits pequenos, um por funcionalidade.
- Comentários e textos de interface em português.

---

## 17. Referências para estudo

- TradingAgents (Tauric Research): artigo arXiv 2412.20138 e repositório open source
- EvoTraders (AgentScope): exemplo de "trading room" visual
- Documentação de LangGraph, Three.js / React Three Fiber, lightweight-charts e yfinance
- Alertas da CVM sobre opções binárias e plataformas não autorizadas
