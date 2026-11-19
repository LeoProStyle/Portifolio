# Progresso do projeto — Sala de Operações (modo simulado)

> Registro vivo do que foi construído, com quais tecnologias e por quê.
> Atualizado ao fim de cada fase/tarefa. A especificação completa está no [CLAUDE.md](../CLAUDE.md).

**Situação atual:** Fases 1 a 4 + **Escritório de Pregão (Etapas 0–6)** concluídos · próxima: **Etapa 7 — Mesa IA com LLM real**

| Fase | Status | Data |
|---|---|---|
| 1. Fundação (FastAPI, WS, frontend que conecta) | ✅ concluída | 2026-11-18 |
| 2. Dados e indicadores (yfinance, RSS, cache, gráfico) | ✅ concluída | 2026-11-18 |
| 3. Agentes com MockProvider + LangGraph + PaperBroker | ✅ concluída | 2026-11-18 |
| 4. A sala (PixiJS → 3D isométrico) | ✅ concluída | 2026-11-18 |
| Escritório — Etapas 0–2 (contas por robô, estratégias, motor, risco do escritório, agendador, API/tabela) | ✅ concluída | 2026-11-18 |
| Escritório — Etapa 3 (backtest por robô + métricas) | ✅ concluída | 2026-11-19 |
| Escritório — Etapa 4 (escritório 3D v2: HUD, andares, CEO, Gerente Geral, mesas por robô, bloom) | ✅ concluída | 2026-11-19 |
| Escritório — Etapa 5 (sala de Minicontratos: WIN/WDO por proxy, margem, vendido) | ✅ concluída | 2026-11-19 |
| Escritório — Etapa 6 (sala de Cripto: BTC/ETH/SOL, US$, 24/7, fracionária) | ✅ concluída | 2026-11-19 |
| Escritório — Etapa 7 (Mesa IA com LLM real) | ⏳ próxima | — |
| 5. LLM real + debate + orçamento | ⏳ próxima | — |
| 6. Replay/backtest | — | — |
| 7. Polimento | — | — |

---

## Tecnologias em uso

### Ambiente
| Ferramenta | Versão | Para quê |
|---|---|---|
| **uv** (Astral) | 0.13.9 | Gerencia Python e dependências do backend (`uv sync`, `uv run`). Instalado via `winget install astral-sh.uv` |
| **Python** | 3.12.16 | Instalado pelo próprio uv (`uv python install 3.12`), isolado do sistema |
| **Node.js / npm** | 24.15 / 11.12 | Frontend |

> No Windows, depois de instalar o uv é preciso abrir um terminal novo para o comando `uv` entrar no PATH.

### Backend (`backend/`)
| Biblioteca | Versão | Papel no projeto |
|---|---|---|
| **FastAPI** | 0.164 | Rotas REST e WebSocket |
| **uvicorn[standard]** | 0.54 | Servidor ASGI (com `websockets` e `watchfiles` para `--reload`) |
| **Pydantic v2** | 2.14 | Schemas dos eventos WS e validação de tudo que entra/sai |
| **pydantic-settings** | 2.16 | Lê o `.env` para a classe `Settings` |
| **tzdata** | 2026.6 | Base de fusos no Windows (necessária para `America/Sao_Paulo`) |
| **pandas** | 3.1 | Séries de preços e cálculo dos indicadores |
| **numpy** | 2.5 | Cálculos numéricos (EMA, Wilder) |
| **yfinance** | 1.8 | Candles da B3 (tickers `.SA`) e `^BVSP` |
| **feedparser** | 6.0 | Leitura dos feeds RSS de notícias |
| **SQLAlchemy** | 2.1 | Banco SQLite (Core, sem ORM): cache, ordens, patrimônio e log de eventos |
| **LangGraph** | 1.2 | Orquestra o ciclo de decisão como grafo (Notícias ∥ Gráfico → Gestor → Risco → Gestor → Execução) |
| langchain-core | 1.8 | Dependência do LangGraph (não usamos as abstrações de LLM do LangChain) |
| **Alembic** | 1.20.1 | Migrações do SQLite (`backend/migrations/`), aplicadas sozinhas ao subir |
| **PyYAML** | 6.0.3 | Lê o `office.yaml` (salas e robôs) |
| **exchange-calendars** | 4.13.3 | Calendário oficial da B3 (`BVMF`): pula feriados e fins de semana na recuperação de candles |
| **APScheduler** | 3.11.3 | Agendador dos robôs (horário de Brasília): 1d às 18:05, 1h no minuto 5 do pregão |
| pytest · ruff · black · httpx | dev | Testes, lint, formatação, cliente de teste |

### Frontend (`frontend/`)
| Biblioteca | Versão | Papel no projeto |
|---|---|---|
| **Vite** | 8.3 | Dev server e build; proxy de `/api`, `/health` e `/ws` para o backend |
| **React** | 19.3 | Interface |
| **TypeScript** | 7.0 (`strict: true`) | Tipagem; `ws/types.ts` espelha o contrato do backend |
| **Zustand** | — | Estado global da sala (`useRoomStore`) |
| **lightweight-charts** (TradingView) | 5.3 | Gráfico de candles com MM20/MM50 e marcadores de ordens |
| **Three.js** | 0.187 | Escritório 3D isométrico low-poly (WebGL), carregado sob demanda num pacote separado. Usa também `examples/jsm`: `OrbitControls` (zoom/arrastar) e `EffectComposer` + `UnrealBloomPass` + `OutputPass` (brilho dos filetes dourados) |
| **@react-three/fiber** | 9.8 | Three.js como componentes React (compatível com React 19) |
| ~~PixiJS 8.23~~ | — | usado na 1ª versão da sala (pixel art); substituído pelo 3D em 2026-11-18 |
| vitest · oxlint · prettier | dev | Testes, lint (veio no template do Vite no lugar do ESLint), formatação |

---

## Fase 1 — Fundação ✅

**Objetivo:** backend e frontend conversando por WebSocket, com eventos fake.

### O que foi feito
- `app/config.py` — `Settings` com todas as variáveis da seção 12. **`LIVE_TRADING_ENABLED=true` faz o backend recusar a subir** (regra nº 1). Valores vazios no `.env` (`CHAVE=`) usam o padrão.
- `app/events.py` — os 11 tipos de evento da seção 8 como modelos Pydantic, com união discriminada por `type`. `make_event()` valida antes de publicar. `EventBus` é um pub/sub em memória (uma fila por conexão; cliente lento descarta o evento mais antigo em vez de travar o ciclo).
- `app/demo.py` — ciclo de demonstração com sequência fixa de eventos marcados `[demo]` (sem dados nem LLM). Será substituído pelo grafo LangGraph na Fase 3.
- `app/main.py` — `create_app()` (fábrica, facilita testes com dependências falsas), `GET /health`, `POST /api/demo/cycle` (202, recusa ticker fora da lista e ciclo duplicado), `WS /ws`.
- Frontend: `ws/client.ts` (reconexão com backoff exponencial + jitter, 1s → 15s), `ws/types.ts` (espelho do contrato), `store/roomReducer.ts` (função pura que aplica cada evento), painéis `Controls`, `AgentsBoard` (placeholder textual da sala) e `DecisionLog` (linha do tempo clicável com o JSON completo — fonte de verdade). Aviso fixo no rodapé.

### Decisões
- **Reducer puro separado do Zustand** → dá para testar a lógica da sala sem React.
- **Balão de fala resumido no frontend** (≤140 caracteres); o texto completo fica no log.
- Raiz do projeto é `sistema-financeiro/` (o CLAUDE.md cita `trading-room/` como nome ilustrativo).

---

## Fase 2 — Dados e indicadores ✅

**Objetivo:** preços e notícias reais com cache, indicadores calculados em código e gráfico de candles.

### O que foi feito
- `app/clock.py` — `RealClock` e `SimulatedClock` (este já pronto para o replay da Fase 6). Todo dado é filtrado por `clock.now()`.
- `app/db/models.py` — tabelas SQLite: `candles`, `news`, `fetch_log`. Datas guardadas como **epoch em segundos (int)** para comparação simples, sem confusão de fuso.
- `app/indicators/technical.py` — SMA, EMA, RSI, MACD, ATR e volatilidade **em pandas/numpy** (regra nº 4), mais `summarize()`, que gera o resumo compacto que o Agente Gráfico vai receber (último candle + valores atuais, nunca o histórico bruto).
- `app/data/prices.py` — `PriceStore` com `YFinanceFetcher` e cache SQLite (TTL de 15 min).
- `app/data/news.py` — `NewsStore` com Google News RSS por termo + feeds extras de `NEWS_FEEDS`, filtro por termos do ticker e cache.
- Rotas novas: `GET /api/prices/{ticker}?interval=1d|1h&days=` (candles + MM20/MM50 já calculadas), `GET /api/indicators/{ticker}` e `GET /api/news/{ticker}?days=` (máx. 30). O benchmark `^BVSP` também é aceito.
- Frontend: `PriceChart` (lightweight-charts), `IndicatorsPanel`, `NewsPanel`, seletor de candle diário/1h, `api/client.ts` (chamadas tipadas) e `lib/useApi.ts` (carregamento com cancelamento; mantém os dados anteriores na tela enquanto recarrega). Os painéis recarregam a cada ciclo encerrado.

### Convenções dos indicadores (documentadas no código)
| Indicador | Cálculo |
|---|---|
| SMA(n) | média móvel simples |
| EMA(n) | α = 2/(n+1), **semeada com a SMA dos n primeiros** (padrão TA-Lib) |
| RSI(14) | suavização de **Wilder**; sem perdas no período → 100 |
| MACD | EMA12 − EMA26; sinal = EMA9 do MACD; histograma = MACD − sinal |
| ATR(14) | True Range com suavização de Wilder (usado no stop: preço − 2×ATR) |
| Volatilidade 20d | desvio-padrão amostral dos retornos log × √252 (anualizada) |

### Proteção contra look-ahead (regra nº 5)
- **Candle só é entregue quando está completo:** cada candle tem `available_ts`. Diário = **18h do próprio dia** (depois do leilão de fechamento); 1h = abertura + 1h. Às 14h de hoje, o último candle diário entregue é o de **ontem**.
- **Notícia sem data de publicação é descartada** (não dá para provar que não é do "futuro" num replay).
- Notícias só entram se `since ≤ publicada ≤ until`.

### Regras do cache
- Uma nova busca acontece só se: (a) nunca buscou; (b) pediu um período mais antigo que o guardado; ou (c) pediu dados mais novos que a última busca **e** o cache tem mais de 15 min.
- O TTL usa o **relógio de parede**, não o simulado: um replay no passado usa o cache sem refazer a busca.
- Se a rede falhar, o sistema registra um aviso e segue com o que já tem no cache (não quebra o ciclo).
- O INSERT de candles é feito em lotes de 500 (limite de parâmetros do SQLite).

### Verificado com dados reais (18/11/2026, 14h)
- PETR4: 272 candles diários, fechamento de 17/11 R$ 43,98, IFR14 31,2, MM20 49,87, MM50 50,81.
- Candles de 1h de ITUB4 até 13:00 (o candle das 14:00 ainda não fechou → não aparece).
- ^BVSP funcionando; 20 manchetes de PETR4 via Google News.

### Limitações conhecidas
- **yfinance é não oficial e atrasado** (~15 min): serve só para estudo.
- **Filtro de notícias por palavra gera ruído** (ex.: "Vale" pega "vale a pena"; patrocínios culturais da Petrobras). Na Fase 3 o Agente Notícias vai avaliar a relevância de cada manchete.
- O Google News RSS só traz notícias recentes; para replays longos no passado o histórico de notícias será limitado ao que já estiver no cache.

---

## Fase 3 — Agentes, grafo e PaperBroker ✅

**Objetivo:** ciclo de decisão completo, sem custo (MockProvider), com carteira simulada.

### O que foi feito
- **LLM** (`app/llm/`): `provider.py` (interface `LLMProvider` + `create_provider`; `anthropic`/`openai` avisam que chegam na Fase 5), `mock.py` (`MockProvider` determinístico, custo zero) e `budget.py` (`Usage`: tokens e custo por ciclo).
- **Agentes** (`app/agents/`):
  - `base.py` — classe `Agent[T]`: prompt `.md` + entrada montada em código + saída Pydantic. JSON inválido → **uma** nova tentativa → resultado **neutro** + erro registrado. Emite `agent_status` (thinking → done/error), `agent_message` (balão) e `agent_result` (JSON completo).
  - `schemas.py` — `NewsResult`, `ChartResult`, `Proposal`, `RiskResult`, `Decision`.
  - `news_agent.py` — sem notícias não chama o LLM (sentimento 0, confiança 0); **remove fontes que não vieram da ferramenta**.
  - `chart_agent.py` — recebe só o resumo de `summarize()`; sem candles → neutro.
  - `risk_agent.py` + `risk_rules.py` — limites calculados **em código antes e depois** do LLM; o LLM só pode ser mais conservador. Emite `risk_veto`.
  - `manager_agent.py` — Gestor em duas etapas (proposta e decisão final); `finalize_decision` força ESPERA se o Risco reprovou e corta `qty` acima de `max_qty`.
  - `prompts/*.md` — 5 prompts em português, versionados, pedindo **somente JSON**.
- **Grafo** (`app/graph/workflow.py`): LangGraph `StateGraph` com Notícias e Gráfico **em paralelo** e nó final de Execução.
- **Executor** (`app/cycle.py`): `CycleRunner` processa o mercado (ordens pendentes e stops), monta a entrada **só com dados ≤ `clock.now()`** e confere isso (`assert_no_future` → `LookAheadError`), roda o grafo, registra o patrimônio e emite `portfolio_update` e `cycle_finished` (tokens e custo). Um ciclo por vez (lock).
- **Corretora** (`app/broker/`): `base.py` (interface `Broker` + `create_broker`, que **só devolve o PaperBroker**) e `paper.py` (`PaperBroker`).
- **Rastreabilidade** (`app/event_store.py`): todo evento publicado é gravado na tabela `events_log`.
- **API**: `POST /api/cycle` (substitui o ciclo demo da Fase 1, que foi removido), `GET /api/portfolio`, `GET /api/orders`, `GET /api/events`.
- **Frontend**: botão **Rodar ciclo**, painel **Carteira simulada** (patrimônio, caixa, resultado, P&L do dia, posições, ordens pendentes, custo do ciclo), **marcadores de compra/venda/stop** no gráfico, placa **PARE** no Risco, resumo legível de cada agente na linha do tempo e **histórico carregado do banco** ao abrir a página.

### Regras do PaperBroker
| Regra | Implementação |
|---|---|
| Preço de execução | **abertura do primeiro candle que abriu depois da ordem** (ordem às 14h de 18/11 → abertura de 19/11) |
| Slippage | sempre contra: compra × (1 + 0,05%), venda × (1 − 0,05%) |
| Taxa | 0,03% do valor executado |
| Lote | fracionário, 1 ação (simplificação) |
| Stop | checado a cada candle novo; com gap abaixo do stop, sai na abertura |
| Caixa insuficiente | quantidade reduzida ao que cabe; se não couber nada, ordem rejeitada |
| Venda a descoberto | não permitida (venda limitada à posição) |
| Persistência | tabelas `orders`, `equity_history`, `broker_cursor`; caixa e posições são **reconstruídos das ordens executadas** ao reiniciar |

### Regras de risco (em código)
- Stop = preço − 2 × ATR14.
- Quantidade máxima = menor entre: risco de 1% do patrimônio ÷ (preço − stop) · exposição de 20% do patrimônio · caixa disponível.
- Perda do dia ≥ 3% (contra o último patrimônio registrado antes do dia) → **veta tudo**.
- Sem ATR/preço → reprova compra. Venda só até a posição.

### Decisões
- **MockProvider com regras simples** (pontuação = 0,6 × sinal do gráfico + 0,4 × sentimento × confiança): serve só para o ciclo rodar de ponta a ponta sem custo; **não é estratégia**. O texto dos resultados vem marcado com `[mock]`.
- **Execução em candle diário**: como a decisão usa indicadores diários, a ordem executa na abertura do próximo pregão. Na prática, uma ordem criada hoje aparece executada só depois do fechamento de amanhã (quando o candle de amanhã fica completo).
- **Contrato WS estendido**: `order_filled` ganhou `ticker`, `reason` (decisao/stop) e `time`; `portfolio_update` ganhou `initial_cash` e, por posição, `stop`, `mark` e `pnl`.
- **Fonte de verdade = banco**: a linha do tempo da tela é recarregada de `/api/events`.

### Verificado com dados reais (18/11/2026, 15h)
- Ciclo de PETR4 em 0,3 s, 4.052 tokens (estimados), custo US$ 0. Gráfico: tendência de baixa (fechamento 43,98 < MM20 49,87 < MM50 50,81) → proposta e decisão **ESPERA**. PETR4, VALE3 e ITUB4 estavam em baixa nesse dia; o caminho de COMPRA → ordem pendente → execução no próximo candle está coberto pelos testes com dados simulados.

---

## Fase 4 — A sala (1ª versão: PixiJS, depois substituída pelo 3D — ver "Redesign") ✅

**Objetivo:** os bonecos animados, dirigidos apenas pelos eventos do WebSocket.

### O que foi feito (`frontend/src/room/`)
- `sprites.ts` — **pixel art original desenhada em código**: cada boneco é um mapa de 12×16 caracteres (cabelo, pele, olhos, camisa, gravata, calça, sapato) com paleta própria por agente; quadros `idle`, `talk`, `typeA/B` (digitando) e `walkA/B` (andando). Texturas geradas num `<canvas>` com escala **nearest**. Nenhum arquivo de terceiros (regra nº 7).
- `layout.ts` — planta da sala em pixels lógicos **256×144** (16:9), mesas, terminal e posições; a cena é ampliada por um **fator inteiro** para manter o pixel nítido.
- `director.ts` — **função pura** que traduz cada evento WS em ações da sala (`work`, `finish`, `say`, `veto`, `toTerminal`, `terminalFlash`, `lights`, `allIdle`).
- `brain.ts` — **máquina de estados pura** de cada boneco: `idle → walking → working → talking → idle`, com rota (ir ao terminal, esperar, voltar) e tempo.
- `Character.ts` — sprite + acessórios: jornal "virando páginas" (Notícias), digitação (Gráfico/Risco/Gestor), "!" em caso de erro, **placa PARE** do Risco; profundidade por posição (a mesa cobre as pernas).
- `SpeechBubble.ts` — balão de fala (máx. 140 caracteres, some em 5 s), numa camada de texto fora da escala para ficar legível.
- `RoomScene.ts` — cena: parede, piso xadrez, painel de cotações, janela, tapete, 4 mesas com objetos (monitor de manchetes, monitores de candles, balança e escudo, notebook e caneca), terminal de ordens que **pisca verde/vermelho** quando uma ordem executa, e **luz** que acende no início do ciclo e apaga no fim.
- `RoomCanvas.tsx` — monta o PixiJS (import dinâmico), redimensiona com `ResizeObserver` e liga os **eventos ao vivo** (`lastLive` no store) ao diretor. O histórico carregado do banco não reanima a sala.

### Reações da sala
| Evento | Na sala |
|---|---|
| `cycle_started` | luz acende, placa PARE baixa |
| `agent_status: thinking` | boneco trabalha (lê/digita) |
| `agent_status: done` | boneco "fala" 1,5 s e volta a ficar parado |
| `agent_status: error` | idem + "!" amarelo por 3 s |
| `agent_message` | balão de fala |
| `risk_veto` | Risco levanta a placa PARE |
| `decision` | Gestor anda até o terminal, digita e volta |
| `order_filled` | tela do terminal pisca (verde compra / vermelho venda) |
| `cycle_finished` | luz apaga, todos param |

### Acessibilidade
- O canvas é decorativo (`aria-hidden`); o container tem descrição e, abaixo dele, os **cards de status em texto** continuam. Tudo que a animação mostra está na linha do tempo.
- `prefers-reduced-motion`: sem andar/piscar; o Gestor "teletransporta" ao terminal.
- Sem WebGL, a sala mostra um aviso e o resto da tela continua funcionando.

### Decisões
- **Sprites em código em vez de pacote externo**: arte própria, sem download nem dúvida de licença. Dá para trocar por um pacote CC0 (ex.: Kenney) depois, só substituindo `sprites.ts`.
- **Lógica separada do desenho** (`director` e `brain` puros) → testável sem PixiJS.
- Em dev, a cena fica em `window.__room` para depuração.

---

## Redesign da sala — 3D isométrico (Three.js) ✅

**Motivo:** o usuário trouxe duas referências (`referencia/*.webp`): salas de trading em 3D isométrico low-poly, com fileiras de mesas, vários monitores, placas de P&L flutuando sobre cada operador e telão com gráfico. A pixel art 2D não chegava nesse nível.

**Escolhas do usuário:** 3D com Three.js · 4 agentes + **uma mesa por ativo** (sem multidão decorativa: tudo na cena representa dado real).

### O que mudou
- **Saiu:** PixiJS e a pixel art (`sprites.ts`, `layout.ts`, `Character.ts`, `SpeechBubble.ts`, `RoomScene.ts`).
- **Ficou (reaproveitado):** `director.ts` (evento → ação) e `brain.ts` (máquina de estados), com os testes — a lógica não mudou, só o desenho.
- **Entrou** (`frontend/src/room/`):
  - `Room3D.tsx` — cena R3F: câmera **ortográfica isométrica** fixa, luz ambiente + direcional com **sombras**, luminárias, piso em ladrilhos, paredes, janela, plantas, bebedouro.
  - `models3d.tsx` — modelos **low-poly próprios** (primitivas): mesa, monitor, cadeira de escritório, planta, bebedouro, **boneco articulado** (tronco, cabeça, cabelo, braços e pernas com pivô: digita, lê jornal, anda, fala, respira), **robô operador** (visor e antena) e **placa PARE** octogonal.
  - `layout3d.ts` — planta em metros (agentes à esquerda sobre tapete, mesas dos ativos em fileira, terminal e telão na parede do fundo).
  - `fx.ts` — estado dos efeitos (balões, alertas, veto, luz, piscar do terminal) + cérebros dos bonecos; recebe as ações do diretor. Testado sem Three.js.
  - `labelRegistry.ts` + `labels3d.tsx` — **etiquetas HTML por cima do canvas** presas em pontos 3D (projeção a cada quadro). Substituiu o `<Html>` do drei, que cria uma raiz React por etiqueta e **sumia com etiquetas** no modo estrito do React 19.
  - `canvasTexture.ts` — textos e gráficos desenhados em `<canvas>` (placa da sala, telão, placa PARE): **nenhuma fonte baixada de CDN**.
- **Mesas por ativo:** um robô por ticker configurado; placa flutuante **verde/vermelha/cinza** com quantidade e P&L simulado (vem de `portfolio_update`); monitores mudam de cor com o P&L.
- **Telão:** gráfico de área dos últimos 90 dias do ativo selecionado, com preço e variação.
- **Store:** `tickers`/`benchmark` passaram para o Zustand (os controles e a sala usam a mesma lista).

### Problemas encontrados e corrigidos
- **Etiqueta do Notícias sumia** → causa: `<Html>` do drei + React 19 StrictMode ("unmount a root while React was already rendering") → troca pela camada própria de etiquetas.
- **"Too many active WebGL contexts" (23×)** → a checagem de WebGL criava um contexto novo a cada renderização → agora checa uma vez e libera o contexto de teste.
- **Telão escuro** → moldura e tela no mesmo plano (z-fighting) → tela levemente à frente.
- **Aviso de sombra** (PCFSoftShadowMap removido no Three.js 0.187) → `shadows={{ type: PCFShadowMap }}`.

### O que NÃO foi copiado das referências
Logotipos, nomes de empresas, escudos de clube e marcas de campeonato (regra nº 7). A sala tem identidade própria ("SALA DE OPERAÇÕES · simulação educacional").

### Desempenho
- A cena fica num pacote separado (~250 KB gzip) carregado só quando a sala aparece; a página abre com ~134 KB gzip.

---

## Escritório de Pregão — Etapas 0–2 ✅

Design aprovado: `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` · Plano: `docs/superpowers/plans/2026-11-18-escritorio-etapas-0-2.md` · Ledger de execução (com todas as decisões): `.superpowers/sdd/2026-11-18-escritorio-etapas-0-2/progress.md`.

Vários robôs operando em paralelo, **cada um com conta simulada própria (R$ 100 mil)** e P&L visível. Tudo continua em paper trading: nenhuma ordem real existe.

### O que foi feito (2026-11-18)
- **Correções da auditoria:** candle parcial do dia nunca é gravado como fechado (DATA-001); `assert_no_future` compara o instante em que o candle fica completo; falha ao gravar evento não trava o ciclo (ARCH-001); backend aceita só hosts `localhost`/`127.0.0.1` e o WebSocket recusa `Origin` de outros sites (SEC-001, variável `ALLOWED_HOSTS`).
- **Banco:** SQLite em modo WAL + `busy_timeout`; migrações **Alembic** 0001–0004 (`backend/migrations/`), aplicadas sozinhas ao subir. O banco real foi migrado sem perder dados (backups no scratchpad da sessão).
- **Escritório em YAML:** `backend/office.yaml` (ou `OFFICE_CONFIG`) com a sala Ações B3 e 6 robôs: ATLAS (cruzamento de médias, PETR4), ORION (reversão IFR, VALE3), VEGA (Donchian, ITUB4), RIGEL (tendência ATR, PETR4), NOVA (bandeira de alta, VALE3) e MESA IA (equipe de agentes, PETR4).
- **Conta por robô:** tabela `runs`; cada execução é uma conta (`account_id`). Mudou estratégia/parâmetros/ativo/limites → nova execução com conta zerada (os números nunca misturam configurações). A carteira das Fases 1–4 virou a execução `legacy-mesa-ia`.
- **Estratégias em código** (`backend/app/strategies/`): 7 estratégias puras + plano de saída (stop por ATR e **alvo 2R**). Regras de bull flag, retomada da MM20, repique de sobrevenda, alvo em R e recusas de ordem adaptadas do **Trader skill v2** (Jake Schincariol, licença MIT). As skills não foram instaladas: são só para EUA e a `trader-broker` envia ordem real (regra 1).
- **PaperBroker com alvo:** a cada candle checa o stop primeiro (conservador) e depois o alvo; a saída fica registrada com motivo `stop` ou `alvo`.
- **Motor de decisão** (`app/engine/step.py`): o robô só vê candles já fechados no instante; venda nunca é bloqueada; compra passa por limite de operações do dia, liquidez mínima, plano de saída, risco do robô e risco do escritório. Eventos levam `room` e `robot_id`.
- **Recuperar ao ligar** (`app/engine/catchup.py`): se o PC ficou desligado, ao religar cada robô decide, em ordem, em cada horário perdido (calendário B3). Um cursor por conta impede decidir duas vezes. Na primeira vez só roda o horário mais recente (histórico é papel do backtest).
- **Gerente Geral = risco do escritório** (`app/engine/office_risk.py`): perda do dia da sala/prédio atinge o limite → **bloqueia compras novas até a meia-noite, mantém stops e alvos**; exposição somada de todos os robôs num ativo limitada a 40% da sala; pausa manual de robô, sala ou prédio.
- **Agendador** (`app/engine/scheduler.py`, APScheduler): ao subir o servidor roda a recuperação em segundo plano e agenda um job por robô habilitado (1d: seg–sex 18:05; 1h: minuto 5, 11h–18h). Erro num robô só gera log.
- **API do escritório** (`app/office/routes.py`): `GET /api/building`, `GET /api/rooms/{sala}/robots`, `GET /api/robots/{id}` (ordens + curva de patrimônio), `POST /api/robots/{id}/pause|resume`, `POST /api/rooms/{sala}/pause|resume`.
- **Frontend:** painel **Escritório · robôs** (`panels/RobotsPanel.tsx`) com P&L total e do dia (verde/vermelho), último sinal e motivo, status, ordenação e botões pausar/retomar; recarrega a cada evento de robô. Eventos de robô não mexem na sala/carteira da equipe de IA. A carteira do painel antigo agora se chama "Carteira simulada · Mesa IA".
- **Comando novo do backend:** `uvicorn app.main:create_app --factory` (importar o módulo não abre mais o banco).

### Verificado com dados reais (18/11/2026, 17h40)
- Migrações 0003/0004 aplicadas no banco real; recuperação rodou para os 5 robôs de regras com candles do yfinance (todos em ESPERA, com motivo legível, ex.: "sem cruzamento: MM9 44.77 x MM21 50.25").
- `/api/building`: 6 contas × R$ 100 mil = R$ 600 mil. Ciclo manual da Mesa IA (mock) não tocou nas contas dos outros robôs.
- Tabela no navegador + pausar/retomar pelo botão funcionando; corrigida uma rolagem horizontal da página causada pela tabela.

### Limitações conhecidas
- O ciclo manual da Mesa IA (`/api/cycle`) não respeita a pausa do robô `mesa-ia` (a pausa vale para o agendador).
- Decisões dos robôs aparecem na tabela e no log do banco, mas não no DecisionLog da sala de IA.
- A Mesa IA também entra no agendador (1 ciclo de agentes por dia, 18:05). Com LLM real isso consome orçamento (limitado por `MAX_COST_PER_DAY`).

## Escritório de Pregão — Etapa 3: backtest por robô ✅

Plano: `docs/superpowers/plans/2026-11-19-escritorio-etapa-3-backtest.md`.

### O que foi feito (2026-11-19)
- **Mesmo passo do ao vivo:** `engine/step.py` ganhou `decide_step` (núcleo do passo). O ao vivo e o backtest usam exatamente a mesma estratégia, plano de saída, risco do robô, taxas, slippage e execução na abertura do candle seguinte.
- **Runner** (`app/backtest/runner.py`): cria uma execução `mode="backtest"` com conta zerada própria, carrega os candles uma vez e, em cada horário de decisão do calendário B3, entrega ao robô só candles já fechados (mesma janela do ao vivo). Sem eventos na sala e sem risco do escritório. Não entra no P&L do prédio nem da tabela de robôs.
- **Métricas** (`app/backtest/metrics.py`, funções puras): retorno, drawdown máximo, operações fechadas, taxa de acerto, fator de lucro, resultado médio, taxas e slippage pagos, comprar e segurar o ativo, Ibovespa (`^BVSP`) e custo de LLM (0 para robôs de regras).
- **Veredito** (critério do spec §8 + regras de amostra do Trader skill v2, MIT): período ≥ 2 anos; bate o ativo e o Ibovespa depois dos custos; drawdown ≤ `CANDIDATE_MAX_DRAWDOWN` (20%); ≥ `CANDIDATE_MIN_TRADES` operações (20); fator de lucro > 1. Benchmark sem dados não reprova. Passar **não** libera conta real (faltam 3 meses ao vivo).
- **Banco:** migração **0005** (tabela `backtests` com o resultado em JSON).
- **API:** `POST /api/robots/{id}/backtest` (`{start?, end?}`, padrão 2 anos), `GET /api/robots/{id}/backtests`, `GET /api/backtests/{run_id}` (curva de patrimônio, curva de comprar e segurar, execuções). Mesa IA → 400; período inválido/futuro → 400; um backtest por vez (409).
- **Frontend:** painel **Backtest por robô** (`panels/BacktestPanel.tsx` + `backtest.ts`): escolhe robô e período (1/2/3 anos), mostra checklist do veredito, métricas, gráfico robô × comprar e segurar, histórico e o aviso de limitações.

### Verificado com dados reais (19/11/2026)
- ATLAS (cruzamento de médias, PETR4), 2 anos: 497 decisões em ~30 s; −1,18% contra +46,0% do PETR4 e +30,7% do Ibovespa; 12 operações, acerto 41,7%, fator de lucro 0,82, drawdown 6,2%, R$ 362 em custos → **não passou**. Patrimônio do prédio continuou R$ 600 mil.

### Limitações conhecidas
- O replay roda dentro do servidor (~30 s para 2 anos diários); a tela mostra "Rodando…".
- Execuções de backtest ficam guardadas no banco (ordens e patrimônio da conta `bt-…`); ainda não há botão para apagar.

## Escritório de Pregão — Etapa 4: escritório 3D v2 ✅

Plano: `docs/superpowers/plans/2026-11-19-escritorio-etapa-4-3d-v2.md`.

A página virou o **escritório de pregão** da referência principal: escuro, filetes dourados com brilho, uma mesa por robô com placa de resultado, Diretoria com o CEO e o Gerente Geral. Continua sendo **teatro dos dados**: todo número do 3D vem da API (ledger) e aparece também na tabela em texto.

### O que foi feito (2026-11-19)
- **API** (`app/office/routes.py` + `app/office/curves.py`): cada robô ganhou `realized_pnl` (operações fechadas, com taxas), `unrealized_pnl` (posições abertas), `spark` (últimos 30 patrimônios, para os monitores) e `look` (aparência do operador vinda do `office.yaml`). Rota nova `GET /api/rooms/{sala}/equity`: curva da sala = soma das contas, com o último valor conhecido de cada robô (`sum_curves`, função pura).
- **HUD** (`panels/HUD.tsx`): andares **Diretoria · Ações B3 · Minicontratos · Cripto** (os dois últimos desabilitados, "em breve"), patrimônio total, resultado de hoje, alternador **Fechados | Abertos | Ambos**, "● simulado" e conexão.
- **Andar de Ações** (`room/floors/TradingFloor.tsx`): uma mesa preta por robô de regras, com operador sentado (pessoa simples, roupa casual, cores estáveis por robô), monitor com a **mini-curva** da conta e monitor com nome/ativo/último sinal; **placa flutuante nome + P&L** (verde/vermelho, clicável); telão com a **curva de patrimônio da sala**. Robô pausado → operador para de digitar e o monitor mostra PAUSADO.
- **Ilha da Mesa IA** (`room/floors/AgentIsland.tsx`): os 4 agentes, o terminal e a placa PARE de antes (mesmo director/brain), com a placa MESA IA + P&L da conta `mesa-ia`.
- **Diretoria** (`room/floors/Boardroom.tsx`): **CEO** careca, de terno e óculos de lente clara, sentado de frente; **Gerente Geral** de terno, em pé, com balão que só fala fatos do prédio ("Prédio hoje +R$ X · nenhum limite atingido." ou o motivo da pausa); telão com patrimônio por andar e **ranking** dos robôs; mesa de reunião.
- **Visual:** filetes dourados com **bloom** (`UnrealBloomPass` dos exemplos do Three.js: só o que é mais claro que 1 brilha), cidade à noite na janela, piso e paredes escuros. **Zoom e arrastar** com limites (OrbitControls sem rotação; o alvo não sai do piso; zoom de ×0,7 a ×2,5).
- **Painel do robô** (`panels/RobotDetail.tsx`): abre ao clicar na mesa, na placa ou em "Ver" na tabela; mostra patrimônio, P&L total/fechado/aberto/dia, último sinal e motivo, **curva de patrimônio** (lightweight-charts), últimas ordens e pausar/retomar. Selecionar um robô também troca o ativo do gráfico, dos indicadores e das notícias.
- **Tabela por andar** (`panels/RobotsPanel.tsx`): o mesmo conteúdo do 3D em texto (nome, estratégia, P&L conforme a visão escolhida, hoje, último sinal, status); na Diretoria lista todos os robôs.
- **Estado do escritório** (`frontend/src/office/`): `office.ts` (regras puras: andares, P&L fechado/aberto, formato com sinal, ranking, fala do Gerente Geral, aparência dos operadores, mini-curva normalizada), `deskLayout.ts` (até 20 mesas por andar sem sobrepor a ilha; limites da câmera), `useOfficeStore.ts` e `useOfficeData.ts` (recarrega a cada evento de robô, a cada ciclo e a cada 60 s).

### Decisões
- **Sem dependência nova:** bloom e controles de câmera vêm de `three/examples/jsm` (MIT, já instalado), em vez de `@react-three/postprocessing`.
- **P&L fechado × aberto:** "livro" = caixa + custo das posições; fechado = livro − capital inicial; aberto = patrimônio − livro (a soma bate exatamente com o total).
- **2 monitores por mesa** (mini-curva + sinal): são os dois dados reais de cada robô.
- **Melhorias de gráfico da auditoria (ARCH-007)** ficam para a Etapa 8 (Polimento).
- **Sem instancing** por enquanto (6 robôs); entra quando um andar passar de ~15 mesas.
- **Gerente Geral sem LLM:** a fala é montada em código a partir do prédio; o resumo do dia com LLM fica para a Etapa 7.

### Verificado no navegador (19/11/2026)
- 1440×900: Ações com 5 mesas + ilha + telão (R$ 600.000,00), placas iguais à tabela e a `/api/rooms/acoes/robots` (todos +R$ 0,00: nenhum robô operou ainda); clique na placa e na mesa 3D abre o painel (anel dourado na mesa); Diretoria com CEO, Gerente Geral e telão; Fechados/Abertos troca HUD e tabela; o ciclo da Mesa IA ainda anima a ilha (Gestor vai ao terminal); console sem erros novos.
- Celular (485 px): sem rolagem horizontal; o HUD deixa de ser fixo.

### Limitações conhecidas
- Sobre a cena, a roda do mouse dá zoom (não rola a página); no celular, um dedo arrasta a cena.
- Com todos os robôs em ESPERA desde o início, placas e curvas ainda estão em zero: os números mudam quando houver operações.
- Revisão final (revisor independente): corrigidos controles de câmera duplicados no modo dev (zoom sem limite), painel do robô mostrando dados do robô anterior durante a troca e prejuízo falso no telão quando um robô está desligado.
- O pacote 3D cresceu para ~261 KB gzip (bloom + controles); continua carregado só quando a cena aparece.
- Depois de puxar estas mudanças, rode o Vite uma vez com `npx vite --force` se a cena não carregar (cache de dependências antigo).

## Escritório de Pregão — Etapa 5: sala de Minicontratos ✅

Plano: `docs/superpowers/plans/2026-11-19-escritorio-etapa-5-minicontratos.md`.

Novo andar **Minicontratos B3** com 3 robôs (SIRIUS e ALTAIR no WIN, POLARIS no WDO), conta de **R$ 100 mil cada**, que **compram e vendem a descoberto**, sempre em simulação.

### Limitação declarada (aparece na sala, na tabela e no painel do robô)
- Não há fonte gratuita confiável do contrato futuro: **WIN ≈ `^BVSP`** (pontos do índice) e **WDO ≈ `USDBRL=X` × 1000** (dólar à vista).
- Sem **base** (diferença entre futuro e à vista) e sem **rolagem de vencimento**.
- Custos e margens são **estimativas configuráveis** no `office.yaml` (não são valores oficiais da B3).

### O que foi feito (2026-11-19)
- **Configuração** (`office.yaml` + `app/office/config.py`): seção `instruments` (símbolo, proxy, escala, multiplicador, custo por contrato, margem, slippage em pontos); sala `minis`; campo `short` no robô (só vale para instrumento; muda o hash, então abre conta nova); risco por operação opcional por sala (`max_risk_per_trade`).

| Contrato | Proxy | R$/ponto | Custo/contrato | Margem/contrato | Slippage |
|---|---|---|---|---|---|
| WIN | `^BVSP` | 0,20 | R$ 0,50 | R$ 4.000 | 5 pontos |
| WDO | `USDBRL=X` × 1000 | 10,00 | R$ 1,20 | R$ 9.000 | 0,5 ponto |

- **Conta de futuro** (`app/broker/futures.py`, `FuturesBroker`): o caixa **não** paga o valor do contrato; só recebe/paga o resultado em pontos × multiplicador e os custos. Posição com sinal (negativa = vendido). Abrir consome **margem** (quantidade reduzida/recusada com motivo se não couber); zerar é sempre permitido; uma ordem nunca "vira a mão". Stop e alvo dos dois lados (vendido: stop acima, alvo abaixo; stop primeiro; gap sai na abertura). Reconstruída das ordens ao reiniciar.
- **Lado vendido sem estratégias novas** (`app/strategies/sides.py`): a mesma estratégia roda na série **espelhada** (K/preço, K = último fechamento²): o que cai vira alta. `combine` decide com a posição (só abre a partir de zerado; só zera pelo próprio lado). `size_contracts`: contratos inteiros pelo menor entre risco permitido e margem livre; perda do dia atingida → 0.
- **Motor** (`app/engine/futures.py` + `step.py`): robôs de instrumento recebem candles do proxy em pontos (`app/data/instruments.py`); o passo de ações ficou igual (só foi separado em `_stock_decision`). Exposição do escritório para minis = **margem em uso**.
- **Sem look-ahead no câmbio** (`app/data/prices.py`): o yfinance marca o candle diário do câmbio à meia-noite de Londres (21h de Brasília do dia anterior); ele só fica "completo" **24h depois** (antes, seria tratado como fechado às 18h — candle ainda em negociação).
- **Backtest de minis** (`app/backtest/`): mesma regra do ao vivo; benchmark = **1 contrato de WIN comprado e segurado** (em R$ sobre o capital); operações vendidas entram nas métricas.
- **Frontend:** andar **Minicontratos** liberado no HUD (mesma cena das ações, sem a ilha da Mesa IA e com um painel de **proxies** em pé); status "vendido (n contratos)"; aviso de proxy na tabela e no painel do robô; abrir um robô de minis não troca o ativo do gráfico de ações.

### Verificado com dados reais (19/11/2026)
- Ao subir, a recuperação decidiu os 3 robôs novos com yfinance: WIN em ~170.500 pontos, WDO em ~5.782 pontos. SIRIUS e ALTAIR em ESPERA (sem cruzamento / dentro do canal, nos dois lados).
- **Achado:** o POLARIS quis comprar, mas 1 WDO com stop de 2×ATR arrisca ~R$ 1.900 (> 1% de R$ 100 mil) → nunca operaria. A sala de minis passou a usar **2%** por operação (`max_risk_per_trade: 0.02`), que permite 1 contrato.
- **Backtest real de 2 anos do SIRIUS (WIN, cruzamento de médias, comprado e vendido):** 497 decisões, 15 operações, acerto 33%, fator de lucro 1,03, drawdown 6,2%, R$ 28 de custos + R$ 56 de slippage; **+0,38%** contra **+7,9%** de 1 contrato de WIN → **não passou**.
- Navegador: andar de Minis com 3 mesas, painel de proxies, telão R$ 300.000,00; prédio R$ 900.000,00 no HUD; painel do POLARIS com o aviso de proxy; console sem erros.

### Limitações conhecidas
- O proxy não tem a base nem o "salto" da rolagem do contrato real; o resultado em reais é aproximado.
- WDO decide com o candle do câmbio que fechou às 21h do dia anterior (um dia de atraso, para não ver o futuro).
- Custos e margens são estimativas; ajuste no `office.yaml`. Mudar o contrato (multiplicador, proxy, custos, margem) ou o risco da sala **abre conta nova** para os robôs afetados.
- **Revisão final (revisor independente):** corrigido o robô de WDO que repetia a ordem enquanto a anterior ainda estava pendente (o candle do câmbio só fica pronto 24h depois): dobrava posição e risco, e uma ordem de zerar sem posição podia abrir posição sem stop. Agora: ordem pendente → ESPERA; zerar só contra a posição; abrir só a partir de zerado; reinício não aplica stop de ordem que só reduziu.

## Escritório de Pregão — Etapa 6: sala de Cripto ✅

Plano: `docs/superpowers/plans/2026-11-19-escritorio-etapa-6-cripto.md`.

Novo andar **Criptomoedas** com 4 robôs (ANTARES e LYRA no BTC, CAPELLA no ETH, DENEB no SOL), conta de **US$ 20 mil cada**, **só comprado**, **quantidade fracionária** e mercado **24 horas, 7 dias**. Sempre em simulação.

### Desvio do spec (decidido nesta etapa)
O spec previa `ccxt` (Binance, pares USDT). Como a regra do dono é **não instalar ferramentas de terceiros que enviem ordens reais** — e o `ccxt` é uma biblioteca de envio de ordens para exchanges —, os preços vêm do **yfinance** (`BTC-USD`, `ETH-USD`, `SOL-USD`), que já estava instalado e só lê dados. Limitação declarada na tela: preço **agregado**, não de uma corretora específica; pares em **USD** (não USDT).

### O que foi feito (2026-11-19)
- **Sala com moeda, calendário e custos próprios** (`office.yaml` + `app/office/config.py`): `currency: USD`, `calendar: 24x7`, `assets` (ativos aceitos), `fee_pct: 0.001` (0,1%), `slippage_pct: 0.0005`, `qty_step: 0.0001`. Moeda, custos e passo entram no hash do robô (mudar abre conta nova); robôs de ações mantêm o hash.
- **Candle de 24h** (`app/data/prices.py`): cripto (`-USD`) segue a mesma regra do câmbio — o candle diário (00:00 UTC = 21h de Brasília) só fica completo 24h depois.
- **Quantidade fracionária** (`app/broker/paper.py` + `app/agents/risk_rules.py`): `PaperBroker(qty_step=…)` arredonda para baixo no passo (caixa nunca negativo); `size_buy` faz o mesmo cálculo de risco/exposição/caixa com passo (a Mesa IA continua com ações inteiras). Contrato do WebSocket aceita quantidade fracionária.
- **24/7** (`app/engine/catchup.py` + `scheduler.py`): robôs de cripto decidem **todo dia no fechamento das 21:00** (o agendador dispara às 21:05; inclui sábado e domingo); os da B3 continuam só nos pregões.
- **Prédio em reais** (`app/office/fx.py` + `office_risk.py` + `routes.py`): cada sala informa `currency`, `equity` (na moeda), `fx_rate` e `equity_brl`; o prédio soma em reais com o último `USDBRL=X` **completo** no instante (sem look-ahead). Sem cotação → `fx_missing` e a sala em dólar fica fora do total (nada inventado). A perda do dia do prédio usa a mesma cotação no início e no fim do dia (mede os robôs, não o dólar).
- **Backtest de cripto**: calendário 24/7, benchmark = **comprar e segurar BTC**; resultado informa a moeda.
- **Frontend:** andar **Cripto** liberado; tabela, placas, painel do robô, telão e backtest em **US$**; HUD e Diretoria em **R$**; aviso de limitação na sala; HUD e Gerente Geral avisam se faltar a cotação do dólar; rótulo do benchmark do backtest certo por sala (Ibovespa / 1 contrato de WIN / Bitcoin).

### Verificado com dados reais (19/11/2026)
- Recuperação ao subir: BTC ~US$ 67.700 (MM9 67.716 × MM21 72.942, sem cruzamento), ETH no canal 1.712–2.446; **DENEB comprou SOL por sobrevenda (IFR14 28,0)**: ordem de **23,2481** unidades com stop 65,02, criada às 21:05.
- Prédio: Ações R$ 600.000 + Minis R$ 300.000 + Cripto US$ 80.000 × 5,7768 = **R$ 1.362.144,01** (`fx_missing: false`).
- **Backtest real de 2 anos do ANTARES (BTC, cruzamento de médias):** 730 decisões (todo dia), 19 operações, acerto 21%, fator de lucro 0,59, drawdown 6,0%, US$ 119 de taxas + US$ 59 de slippage; **−4,4%** contra **−31,8%** do BTC comprado e segurado → **não passou** (perdeu dinheiro, fator de lucro < 1, poucas operações).
- Navegador: andar de Cripto com 4 mesas, painel de ativos, telão US$ 80.000,00, placas em US$; Diretoria com os 3 andares em R$; console sem erros.

### Limitações conhecidas
- Preço agregado do yfinance (não é o livro de uma exchange); sem taxa de financiamento nem custódia.
- Contas em dólar: o resultado em reais do prédio também varia com o câmbio ao longo do tempo.
- SQLite guarda a quantidade fracionária como REAL (afinidade dinâmica); ao migrar para PostgreSQL a coluna precisa virar NUMERIC.
- **Revisão final (revisor independente):** com o candle de cripto das 21h, a ordem só executava um candle depois e o robô repetia a ordem pendente (posição e risco dobrados). Agora ações e cripto esperam com ordem pendente, a cripto decide no fechamento das 21:00 e a ordem executa na abertura que acontece no mesmo instante (regra de execução "abertura do candle que abre no instante da ordem ou depois"; a B3 diária não muda).

## Avaliação ao vivo (simulação com dados reais) ✅

Plano: `docs/superpowers/plans/2026-11-19-avaliacao-ao-vivo.md`.

### O que foi feito (2026-11-19)
- **Liga com o Windows** (`scripts/`): `instalar-inicio-automatico.ps1` registra a tarefa "Escritorio de Pregao (simulacao)" no Agendador de Tarefas (ao fazer logon; rodar de novo só atualiza); `iniciar-escritorio.ps1` sobe o backend escondido na porta 8000 (não sobe dois; compila a tela se faltar; `-Recompilar` refaz); `remover-inicio-automatico.ps1` desfaz. Logs em `backend/logs/` (fora do git).
- **Um processo só** (`app/main.py`): o backend serve a tela compilada (`frontend/dist`) em `http://localhost:8000`; rotas `/api` e `/ws` têm prioridade; rota de API inexistente continua 404. Origens aceitas no WebSocket incluem a porta 8000 (padrão e `.env`).
- **Dias ao vivo e comprar e segurar** (`app/office/live.py`, funções puras): cada robô informa `live` = desde quando, dias, faltam para 90, retorno do robô desde o início e retorno de **comprar e segurar** o mesmo ativo desde o primeiro candle completo **depois** do início da conta (minis: 1 contrato). Sem dados ainda → "ainda sem dados" (nada inventado).
- **Tela:** coluna **Ao vivo** na tabela (dias de 90) e bloco **Avaliação ao vivo** no painel do robô (robô × comprar e segurar, com o aviso de que candidato só depois de 3 meses e que não é recomendação).

### Verificado (19/11/2026)
- Tarefa registrada e disparada pelo Agendador (resultado 0); `http://localhost:8000` abre a tela, WebSocket conectado, 3D e placas carregados; coluna "Ao vivo" e painel do ATLAS ("ao vivo desde hoje · faltam 90 dias para 3 meses", comprar e segurar "ainda sem dados").
- **Achado na verificação:** o `.env` fixava `CORS_ORIGINS` só com a porta 5173 e o WebSocket recusava a tela da porta 8000 (403) → `.env` e `.env.example` atualizados.
- **Revisão final (revisor independente), corrigido:** a compilação da tela derrubava o script de início no PowerShell 5.1 (avisos do npm/Vite na saída de erro) — agora roda via `cmd`, registra falha e sobe a API mesmo assim; a lista de robôs passou a ler preços **só do cache** (quem atualiza é o motor dos robôs, sem buscas na rede a cada recarga); a Mesa IA não é comparada com um ativo só (opera vários).
- Limitações: o comprar e segurar começa no fechamento do primeiro candle **depois** do início da conta (nos primeiros dias aparece "ainda sem dados"); os logs `escritorio*.log` recomeçam a cada início.

## Robôs rastreadores (escolhem entre vários ativos) ✅

Plano: `docs/superpowers/plans/2026-11-19-robos-rastreadores.md`.

Para comparar, ao vivo e com dados reais, **robô de um ativo só × robô que escolhe entre vários**, cada sala ganhou rastreadores (os robôs antigos ficaram intactos — mesma conta, mesma contagem dos 3 meses):

| Robô | Sala | Lista (fixa, no `office.yaml`) | Estratégia | Vagas |
|---|---|---|---|---|
| ÓRBITA | Ações | 20 ações líquidas da B3 | reversão por IFR | 3 |
| COMETA | Ações | as mesmas 20 | rompimento (Donchian) | 3 |
| QUASAR | Minis | WIN e WDO (compra e vende) | rompimento | 2 |
| PULSAR | Cripto | 10 moedas (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT) | reversão por IFR | 3 |
| NEBULA | Cripto | as mesmas 10 | rompimento | 3 |

- **Como decidem** (`app/engine/scanner.py`): processam execuções/stop/alvo de toda a lista; zeram o que a estratégia mandou sair; se há vagas (posições + ordens pendentes < limite), aplicam a estratégia em todos os ativos, **ordenam** (`app/strategies/rank.py`: IFR → mais sobrevendido primeiro; demais → maior alta de 20 candles) e abrem os melhores com o **mesmo risco** dos outros robôs. Minis usam o contrato de **cada** ativo (WIN ≠ WDO).
- **Comparação justa:** o "comprar e segurar" do rastreador é a **cesta igual** da lista. Lista fixa e declarada (sem escolher hoje "as que mais subiram", que inflaria o resultado).
- **Backtest de rastreador:** ainda não (a API responde com o motivo); são avaliados ao vivo.
- **Verificado com dados reais (19/11/2026):** ÓRBITA comprou BBAS3, RADL3 e PETR4 (sobrevenda); PULSAR comprou BTC, ETH e DOT; QUASAR comprou WDO; COMETA e NEBULA sem rompimento. **Achado:** ELET3 não tem mais dados no yfinance (a Eletrobras agora é **AXIA3**) → lista corrigida.

## Testes

| Onde | Comando | Quantidade |
|---|---|---|
| Backend | `cd backend && uv run pytest -q` | **266** (rastreadores: vagas, ordem pendente, ativo sem dados, contrato por ativo, cesta igual; avaliação ao vivo: dias e comprar e segurar, tela servida pelo backend, 404 da API; cripto: quantidade fracionária, custos da sala, calendário 24/7, prédio em reais pela cotação do instante, backtest com BTC; minicontratos: conta de futuro, vendido, margem, stop/alvo dos dois lados, série espelhada, contratos por risco, candle de 24h do câmbio, motor e backtest de minis; curva da sala, P&L fechado/aberto e mini-curva por robô; backtest: métricas, runner, API; eventos, API, config, indicadores, preços, notícias, rotas de dados, PaperBroker com alvo, risco, agentes, ciclo completo, migrações, office.yaml, contas, estratégias, motor, recuperação, risco do escritório, agendador, API do escritório) |
| Frontend | `cd frontend && npm test` | **75** (rótulo e status do rastreador; texto "ao vivo"; moedas por sala, soma do resultado em reais, rótulo do benchmark; regras do escritório: andares, P&L fechado/aberto, placas, ranking, fala do Gerente Geral, aparência dos operadores, mini-curva, mesas por andar, limites da câmera, seleção e status do robô, robôs desligados fora das somas, detalhe só do robô selecionado; funções do painel de backtest, ordenação da tabela de robôs, separação de eventos de robô, reducer, veto, carteira, histórico, balão, contrato, backoff, horário do gráfico, textos da linha do tempo, diretor da sala, máquina de estados dos bonecos, efeitos da sala 3D, registro de etiquetas) |

Também passam: `uv run ruff check .`, `uv run black --check .`, `npm run lint`, `npx tsc -b` e `npm run build`.

**Todos os testes obrigatórios da seção 15 estão cobertos:**
| Exigência | Onde |
|---|---|
| Indicadores contra cálculo manual | `test_technical.py` |
| Look-ahead: falha se agente receber dado > `clock.now()` | `test_cycle.py::test_nenhum_agente_recebe_dado_do_futuro` (espiona tudo que cada agente recebeu) + `test_prices.py` + `test_news.py` |
| Gestor nunca passa de `max_qty` nem opera após `MAX_DAILY_LOSS` | `test_risk.py` + `test_cycle.py::test_perda_diaria_veta_e_forca_espera` |
| PaperBroker: próximo candle, taxas, slippage, stop | `test_paper_broker.py` |
| JSON inválido → retry → neutro | `test_agents.py` |
| Contrato WS | `test_events.py` + `test_cycle.py` (todo evento emitido é validado) |
| Nenhum broker real com `LIVE_TRADING_ENABLED=false` | `test_paper_broker.py::test_nenhum_broker_real_existe_nem_e_instanciado` |

---

## Como rodar

```bash
# Backend
cd backend
cp ../.env.example .env
uv sync
uv run uvicorn app.main:create_app --factory --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
```

---

## Mapa de arquivos

```
sistema-financeiro/
├── CLAUDE.md · README.md · .env.example · .gitignore
├── docs/PROGRESSO.md                 ← este arquivo
├── backend/
│   ├── pyproject.toml · uv.lock
│   ├── app/
│   │   ├── main.py                   rotas REST + WS (build_runtime + create_app)
│   │   ├── config.py                 Settings (.env)
│   │   ├── clock.py                  RealClock / SimulatedClock
│   │   ├── events.py                 contrato WS + EventBus
│   │   ├── event_store.py            grava todo evento no banco
│   │   ├── cycle.py                  CycleRunner (um ciclo completo)
│   │   ├── db/models.py              tabelas SQLite
│   │   ├── data/prices.py            yfinance + cache
│   │   ├── data/news.py              RSS + filtro + cache
│   │   ├── indicators/technical.py   SMA, EMA, RSI, MACD, ATR, vol
│   │   ├── llm/                      provider.py · mock.py · budget.py
│   │   ├── agents/                   base · schemas · risk_rules · news · chart · risk · manager
│   │   │   └── prompts/              news · chart · manager_proposal · risk · manager_final (.md)
│   │   ├── graph/workflow.py         grafo LangGraph
│   │   ├── broker/                   base.py (interface) · paper.py (PaperBroker com stop e alvo) · futures.py (minicontratos)
│   │   ├── data/instruments.py       candles do proxy em pontos (WIN/WDO)
│   │   ├── db/migrate.py             Alembic programático (upgrade ao subir)
│   │   ├── office/                   config.py (office.yaml, instrumentos, moeda/calendário da sala) · accounts.py (conta por robô) · routes.py (API) · curves.py (curva da sala) · fx.py (USD→BRL)
│   │   ├── strategies/               base · rules (7 estratégias) · exits (stop ATR + alvo 2R, dois lados) · sides (vendido, contratos)
│   │   └── engine/                   step (passo) · futures (passo de minis) · common · catchup (recuperar ao ligar) · office_risk (Gerente Geral) · scheduler
│   ├── office.yaml                   salas e robôs
│   ├── alembic.ini · migrations/     0001_baseline · 0002_accounts · 0003_target_cursor · 0004_office_state · 0005_backtests
│   └── tests/                        fakes · test_events · test_api · test_api_data · test_config
│                                     test_technical · test_prices · test_news · test_paper_broker
│                                     test_risk · test_agents · test_cycle · test_migrate · test_office_config
│                                     test_accounts · test_strategies · test_engine_step · test_catchup
│                                     test_office_risk · test_scheduler · test_api_office
│                                     test_backtest_metrics · test_backtest_runner · test_api_backtest · test_office_curves
└── frontend/
    └── src/
        ├── App.tsx · main.tsx · index.css
        ├── api/client.ts             chamadas REST tipadas
        ├── ws/client.ts · ws/types.ts
        ├── store/roomReducer.ts · store/useRoomStore.ts
        ├── lib/labels.ts · lib/chartTime.ts · lib/useApi.ts
        ├── office/                   office (regras puras) · deskLayout · useOfficeStore · useOfficeData
        ├── room/                     RoomCanvas · Room3D · effects (câmera + bloom) · screens · models3d · look · gold
        │   │                         layout3d · director · brain · fx · labelRegistry · labels3d · canvasTexture
        │   └── floors/               TradingFloor (Ações) · AgentIsland (Mesa IA) · Boardroom (Diretoria) · Shell
        └── panels/HUD · RobotDetail · Controls · PriceChart · Portfolio · RobotsPanel (+ robots.ts) · BacktestPanel (+ backtest.ts) · IndicatorsPanel · NewsPanel · AgentsBoard · DecisionLog
```

---

## Histórico

- **2026-11-18** — Fase 1 concluída (fundação + WS + frontend com reconexão). Corrigido: `.env` com valores vazios quebrava a leitura.
- **2026-11-18** — Fase 2 concluída (yfinance, RSS, cache SQLite, indicadores testados à mão, gráfico de candles). Corrigido: título do Google News com " - Fonte" duplicada.
- **2026-11-18** — Fase 3 concluída (4 agentes + MockProvider, grafo LangGraph, PaperBroker, regras de risco em código, carteira e marcadores na tela). Ciclo demo da Fase 1 e `DEMO_STEP_DELAY_S` removidos.
- **2026-11-18** — Fase 4 concluída (sala PixiJS com pixel art própria, 4 bonecos com máquina de estados, balões, placa PARE, luz e terminal). Corrigido: "[mock]" duplicado no texto da decisão.
- **2026-11-18** — Redesign da sala: PixiJS/pixel art → **3D isométrico low-poly** (Three.js + React Three Fiber), mesas por ativo com P&L, telão, etiquetas HTML próprias. CLAUDE.md atualizado (stack, estrutura, seção 9, regra 7).
- **2026-11-18** — Escritório de Pregão, Etapas 0–2: correções da auditoria, Alembic, office.yaml, conta por robô, 7 estratégias + alvo 2R (regras do Trader skill v2, MIT), motor de decisão, recuperar ao ligar (calendário B3), risco do escritório, agendador, API e tabela de robôs. Backend passa a subir com `--factory`.
- **2026-11-19** — Escritório, Etapa 3: backtest por robô em conta separada (mesmo passo do ao vivo, sem look-ahead), métricas, veredito com critério de candidato, migração 0005, API e painel.
- **2026-11-19** — Escritório, Etapa 4: escritório 3D v2 (HUD com andares, mesa por robô com mini-curva e placa de P&L, ilha da Mesa IA, Diretoria com CEO e Gerente Geral, bloom, zoom/arrastar, painel do robô, tabela por andar); API com P&L fechado/aberto, mini-curva e curva da sala.
- **2026-11-19** — Escritório, Etapa 5: sala de Minicontratos (WIN/WDO por proxy declarado), conta de futuro com margem e venda a descoberto, candle de 24h para câmbio sem look-ahead, backtest com benchmark de 1 contrato de WIN, andar no HUD. Risco por operação da sala de minis = 2%.
- **2026-11-19** — Escritório, Etapa 6: sala de Cripto (BTC/ETH/SOL pelo yfinance em vez do ccxt, por regra do dono), contas em US$, 24/7 às 21:05, quantidade fracionária, custos por sala, prédio consolidado em reais pela cotação do instante, backtest com benchmark BTC.
- **2026-11-19** — Avaliação ao vivo: escritório liga com o Windows (Agendador de Tarefas), backend serve a tela na porta 8000, dias ao vivo (critério de 3 meses) e comparação com comprar e segurar por robô.
- **2026-11-19** — Robôs rastreadores: ÓRBITA, COMETA (ações), QUASAR (minis), PULSAR e NEBULA (cripto) escolhem entre listas fixas de ativos; comparação com a cesta igual; ELET3 → AXIA3.
- **Observação de ambiente (Windows):** o `uvicorn --reload` nem sempre recarrega sozinho; se uma mudança no backend não aparecer, reinicie o servidor.
