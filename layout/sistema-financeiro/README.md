# Sala de Operações com Agentes de IA (modo simulado)

Projeto de estudo: um "escritório de pregão" em 3D isométrico onde agentes de IA
(Notícias, Gráfico, Risco e Gestor) discutem ações da B3 e decidem
COMPRA / VENDA / ESPERA, ao lado de robôs de regras, cada um com sua conta
simulada e P&L próprio — **somente em paper trading**.

> **Simulação educacional. Não é recomendação de investimento.**
> Nenhuma ordem real é enviada. Não há corretora real implementada.

Veja o [CLAUDE.md](CLAUDE.md) para arquitetura, regras e o plano de fases, e o
[docs/PROGRESSO.md](docs/PROGRESSO.md) para o registro do que já foi feito,
tecnologias usadas e decisões.

## Status

- [x] **Fase 1 — Fundação:** FastAPI com `/health`, WebSocket com eventos de
      demonstração e frontend que conecta (com reconexão) e mostra os eventos.
- [x] **Fase 2 — Dados e indicadores:** candles da B3 (yfinance) e notícias (RSS)
      com cache SQLite, indicadores calculados em código e gráfico de candles.
- [x] **Fase 3 — Agentes:** Notícias, Gráfico, Risco e Gestor (MockProvider, sem custo),
      grafo LangGraph, PaperBroker com taxas/slippage/stop e regras de risco em código.
- [x] **Fase 4 — A sala:** 3D isométrico low-poly (Three.js), 4 agentes animados pelos eventos,
      mesas por ativo com P&L, balões de fala, placa "PARE" e Gestor indo ao terminal.
- [x] **Escritório — Etapas 0–2:** vários robôs com conta simulada própria (`office.yaml`),
      7 estratégias em código com stop por ATR e alvo 2R, recuperação de candles perdidos
      ao religar (calendário B3), risco do escritório, agendador e tabela de robôs.
- [x] **Escritório — Etapa 3:** backtest por robô (conta separada, sem ver o futuro), métricas,
      comparação com o ativo e o Ibovespa e veredito com o critério de candidato.
- [x] **Escritório — Etapa 4:** escritório 3D v2 com HUD de andares, uma mesa por robô
      (operador, mini-curva e placa de P&L), Diretoria com CEO e Gerente Geral, brilho dourado,
      zoom/arrastar, painel do robô e tabela acessível por andar.
- [x] **Escritório — Etapa 5:** sala de Minicontratos (WIN ≈ ^BVSP, WDO ≈ USDBRL=X × 1000, proxies
      declarados), contratos inteiros, margem, custo por contrato e venda a descoberto, em simulação.
- [x] **Escritório — Etapa 6:** sala de Cripto (BTC, ETH e SOL pelo yfinance), contas em US$, 24/7,
      quantidade fracionária, prédio consolidado em reais pela cotação do dólar do momento.
- [ ] Fase 5 — LLM real + debate
- [ ] Fase 6 — Replay/backtest
- [ ] Fase 7 — Polimento

## Deixar rodando (avaliação ao vivo com dados reais)

Os robôs só avaliam de verdade se o backend estiver ligado nos horários (18:05 nos pregões;
21:05 todo dia para cripto). Se o PC ficar desligado, ao religar cada robô decide os dias perdidos.

```powershell
# uma vez: liga o escritório sozinho sempre que você entrar no Windows
powershell -ExecutionPolicy Bypass -File scripts\instalar-inicio-automatico.ps1
Start-ScheduledTask -TaskName 'Escritorio de Pregao (simulacao)'   # sobe agora
# abra http://localhost:8000  (API + robôs + tela num processo só)

# depois de mudar o frontend: recompila a tela e sobe
powershell -ExecutionPolicy Bypass -File scripts\iniciar-escritorio.ps1 -Recompilar

# para desfazer o início automático
powershell -ExecutionPolicy Bypass -File scripts\remover-inicio-automatico.ps1
```

Logs em `backend/logs/`. Cada robô mostra **há quantos dias está ao vivo** (critério: 3 meses com a
mesma configuração) e o resultado **contra comprar e segurar** o mesmo ativo desde o início da conta.

## Como rodar

Pré-requisitos: [uv](https://docs.astral.sh/uv/) (instala o Python 3.12 sozinho) e Node 20+.

```bash
# Backend (porta 8000)
cd backend
cp ../.env.example .env        # LLM_PROVIDER=mock por padrão, sem custo
uv sync
uv run uvicorn app.main:create_app --factory --reload --port 8000
uv run pytest -q

# Frontend (porta 5173, repassa /api, /health e /ws para o backend)
cd frontend
npm install
npm run dev
npm test
npm run lint
npm run build
```

O backend sobe com `--factory` (o módulo não cria o app ao ser importado). Ao subir, ele
aplica as migrações do banco, recupera os horários de decisão perdidos de cada robô e
liga o agendador (robôs diários decidem seg–sex às 18:05, horário de Brasília).

Abra http://localhost:5173 e clique em **Rodar ciclo**. Com `LLM_PROVIDER=mock` o ciclo
não tem custo; as ordens simuladas executam na abertura do próximo pregão.

## Robôs do escritório (`backend/office.yaml`)

Salas e robôs ficam em `backend/office.yaml` (ou no arquivo apontado por `OFFICE_CONFIG`).
Cada robô tem `id`, `room`, `ticker`, `interval` (`1d` ou `1h`) e `strategy`
(`sma_cross`, `rsi_reversion`, `donchian`, `atr_trend`, `bull_flag`, `ma20_reclaim`,
`oversold_bounce` ou `mesa_ia`). Mudar estratégia, parâmetros, ativo ou limites abre uma
**conta nova** (os números nunca misturam configurações); mudar nome ou `enabled` não.

Pausar um robô ou sala bloqueia só **compras novas**; posições, stops e alvos continuam.

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| GET | `/health` | status, modo (`paper`), provider do LLM e tickers |
| GET | `/api/prices/{ticker}?interval=1d\|1h&days=180` | candles completos até agora + MM20/MM50 |
| GET | `/api/indicators/{ticker}` | resumo dos indicadores (SMA, EMA, RSI, MACD, ATR, volatilidade) |
| GET | `/api/news/{ticker}?days=7` | manchetes filtradas por ticker (Google News RSS + feeds extras) |
| POST | `/api/cycle` | `{"ticker":"PETR4.SA"}` — roda um ciclo de decisão completo (agentes + PaperBroker) |
| GET | `/api/portfolio` | carteira simulada da Mesa IA: caixa, posições, patrimônio, P&L do dia, ordens pendentes |
| GET | `/api/orders?ticker=&status=` | ordens simuladas (pending, filled, rejected) |
| GET | `/api/events?limit=300` | histórico de eventos (linha do tempo, fonte de verdade) |
| GET | `/api/building` | prédio: patrimônio e P&L do dia por sala, pausas |
| GET | `/api/rooms/{sala}/equity` | curva de patrimônio da sala (soma das contas dos robôs) |
| GET | `/api/rooms/{sala}/robots` | robôs da sala: conta, P&L total (fechado e aberto) e do dia, mini-curva, último sinal e motivo, status |
| GET | `/api/robots/{id}` | um robô + ordens + curva de patrimônio |
| POST | `/api/robots/{id}/pause` · `/resume` | pausa/retoma compras novas do robô |
| POST | `/api/rooms/{sala}/pause` · `/resume` | pausa/retoma compras novas da sala |
| POST | `/api/robots/{id}/backtest` | backtest do robô (`{start?, end?}`, padrão 2 anos; Mesa IA fica de fora) |
| GET | `/api/robots/{id}/backtests` | backtests anteriores do robô (resumo) |
| GET | `/api/backtests/{run_id}` | resultado completo: métricas, veredito, curvas e execuções |
| WS | `/ws` | stream de eventos no contrato da seção 8 do CLAUDE.md |

O contrato de eventos fica em `backend/app/events.py` (Pydantic) e é espelhado
em `frontend/src/ws/types.ts`. Eventos de robôs do escritório trazem também `room` e `robot_id`.
