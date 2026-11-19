# Escritório — Etapa 4: Escritório 3D v2 — Plano

> Execução: superpowers:executing-plans (inline). Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** trocar a "sala da equipe de IA" por um **escritório de pregão** navegável: HUD com andares, sala de Ações com uma mesa por robô (operador + monitores com a mini-curva + placa nome/P&L), ilha da Mesa IA com os 4 agentes, Diretoria com CEO e Gerente Geral, bloom nos filetes dourados, painel lateral do robô clicado e tabela acessível por andar.

**Architecture:** o 3D continua sendo teatro dos dados: tudo vem de `/api/building`, `/api/rooms/{sala}/robots`, `/api/rooms/{sala}/equity` e `/api/robots/{id}`. O estado do escritório (andar, robô selecionado, visão de P&L, dados carregados) fica num store Zustand próprio (`office/useOfficeStore.ts`), carregado por um hook único no `App`. Regras de apresentação (P&L fechado/aberto, placas, ranking, fala do Gerente Geral, aparência dos operadores, posição das mesas, limites da câmera) são funções puras testadas. A cena é dividida por andar (`room/floors/`); bloom e controles de câmera usam os módulos que já vêm no Three.js (sem dependência nova).

**Tech Stack:** o que já existe. Bloom = `three/examples/jsm/postprocessing` (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`); zoom/arrastar = `three/examples/jsm/controls/OrbitControls`. Nenhum pacote novo.

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` §5 (personagens), §11 (interface), §14 (Etapa 4).

## Global Constraints
- Somente paper trading; nenhuma tela sugere lucro. Rodapé fixo: "Simulação educacional. Não é recomendação de investimento." HUD mostra "● simulado".
- Toda placa/número do 3D vem da API (ledger). Nada inventado no frontend.
- Personagens (spec §5): **CEO** = careca, terno, óculos de lente **clara**; **Gerente Geral** = pessoa padrão de terno, sem logo/marca; **operadores** = pessoas simples, roupa casual, variação de cabelo/cor. Tudo com primitivas/canvas próprios (regra 7), sem marcas.
- Andares: Diretoria, Ações (ativo), Minis e Cripto aparecem **desabilitados ("em breve")** até as Etapas 5/6 — opções binárias nunca.
- Visual: escritório escuro, filetes dourados com brilho (bloom), mesas pretas com 2–3 monitores com a mini-curva do robô, placa flutuante **nome + P&L** (verde/vermelho), telão com a curva de patrimônio da sala.
- Interação: zoom e arrastar **com limites**; clique no robô (3D ou tabela) abre o painel lateral.
- Acessibilidade: tabela de robôs em texto por andar (nome, estratégia, P&L do dia e total, status) com o mesmo conteúdo do 3D; `prefers-reduced-motion` respeitado; canvas `aria-hidden`.
- Textos e comentários em português; TS `strict`; oxlint + prettier; ruff + black.

## Review Focus
1. Robô sem histórico de patrimônio (`spark` vazio) → monitor com linha reta e placa "+R$ 0,00", nunca `NaN`. (Task 2: `normalizeSpark([])`, `normalizeSpark([5])`.)
2. Andar sem sala configurada (Minis/Cripto) ou backend fora do ar → HUD mostra "—", botões desabilitados, a cena não quebra. (Task 2: `floorRoom`, Task 4 manual.)
3. Robô selecionado some (YAML mudou) ou troca de andar → painel fecha/mostra "robô não encontrado". (Task 3: `selectedRow` devolve `null`.)
4. 20 robôs num andar → mesas dentro do piso, sem sobrepor a ilha da Mesa IA. (Task 2: `robotDesks(20)`.)
5. Curvas de patrimônio com horários diferentes entre robôs → soma da sala usa o último valor conhecido de cada conta (sem buracos). (Task 1: `sum_curves`.)

---

### Task 1: API — P&L fechado/aberto, mini-curva, aparência e curva da sala
**Files:** `backend/app/office/curves.py` (novo), `backend/app/office/routes.py`, `backend/tests/test_office_curves.py` (novo), `backend/tests/test_api_office.py`
- `sum_curves(curves: list[tuple[float, list[tuple[int, float]]]]) -> list[tuple[int, float]]` — cada item é `(valor_inicial, [(ts, equity)])`; no conjunto de todos os `ts`, soma o último valor conhecido de cada conta (antes do 1º ponto vale o inicial). Teste à mão: `[(100, [(1,110),(3,120)]), (50, [(2,40)])]` → `[(1,160),(2,150),(3,160)]`; lista vazia → `[]`.
- `robot_row` ganha: `unrealized_pnl = equity − livro` e `realized_pnl = livro − inicial`, onde `livro = broker.portfolio({}).equity` (caixa + custo das posições); `spark` = últimos 30 patrimônios da conta (lista de floats); `look` = `robot.look`.
- `GET /api/rooms/{room}/equity` → `[{time, value}]` via `sum_curves` das execuções ao vivo da sala; 404 sala inexistente.
- Testes API: `realized_pnl + unrealized_pnl ≈ pnl`; `spark` tem ≤ 30 itens e termina no `equity`; curva da sala tem `value` final = soma dos `equity` da sala.

### Task 2: Regras de apresentação (funções puras)
**Files:** `frontend/src/office/office.ts`, `frontend/src/office/office.test.ts`, `frontend/src/office/deskLayout.ts`, `frontend/src/office/deskLayout.test.ts`
- `FLOORS: Floor[]` com `{id: 'diretoria'|'acoes'|'minis'|'cripto', label, room: string|null, soon: boolean}`; `floorRoom(floor, rooms) -> RoomSummary|null`.
- `type PnlView = 'fechados'|'abertos'|'ambos'`; `pnlOf(row, view): number`; `sumPnl(rows, view): number`.
- `tone(v): 'up'|'down'|'flat'`; `signedBrl(v): string` (`+R$ 1.234,50` / `-R$ 330,34`; −0 vira `+R$ 0,00`).
- `ranking(rows, view, n = 5)`: maiores P&L primeiro.
- `managerLine(building): string` — fala do Gerente Geral, só com dados: prédio pausado → motivo; sala pausada → nome + motivo; senão "Prédio hoje +R$ X · nenhum limite atingido."
- `operatorLook(id, override?) -> Look` — determinístico por hash do id (paletas de cabelo/pele/camisa casual); `override` do YAML (`hair`, `skin`, `shirt`, `pants`) vence.
- `normalizeSpark(values): number[]` em [0,1] (vazio → `[0.5, 0.5]`; constante → todos 0,5).
- `robotDesks(n): Spot[]` — fileiras de 3 colunas a partir de x=1.6, passo 3.0 em x e 2.8 em z, dentro de `ROOM` (até 20 → aumenta colunas para 4 se passar de 4 fileiras); `clampTarget(x, z): [x, z]` no retângulo do piso.

### Task 3: Store e dados do escritório
**Files:** `frontend/src/office/useOfficeStore.ts`, `frontend/src/office/useOfficeData.ts`, `frontend/src/office/selection.test.ts`, `frontend/src/api/client.ts`, `frontend/src/panels/robots.ts`
- `RobotRow` ganha `realized_pnl`, `unrealized_pnl`, `spark`, `look`; `api.roomEquity(room)`, `api.robot(id)` (`RobotDetail = RobotRow & {orders, equity_curve}`).
- Store: `floor`, `pnlView`, `selectedRobot`, `building`, `robots: Record<room, RobotRow[]>`, `curves: Record<room, PointDTO[]>`, `error`; ações `setFloor` (limpa seleção), `select(id|null)`, `setPnlView`, `setData`.
- `selectedRow(state): RobotRow|null` puro (busca em todas as salas). Teste: id inexistente → `null`; `setFloor` zera a seleção.
- `useOfficeData()` (no `App`): recarrega building + robôs + curva de cada sala quando muda `robotTick` (e a cada 60 s).

### Task 4: HUD, tabela por andar e painel do robô
**Files:** `frontend/src/panels/HUD.tsx`, `frontend/src/panels/RobotsPanel.tsx`, `frontend/src/panels/RobotDetail.tsx`, `frontend/src/App.tsx`, `frontend/src/panels/AgentsBoard.tsx`, `frontend/src/index.css`
- HUD (substitui a topbar): título "Escritório", botões de andar (`aria-pressed`, Minis/Cripto desabilitados com "em breve"), "Hoje" (`building.day_pnl`), "Patrimônio total", alternador Fechados|Abertos|Ambos (P&L somado) e "● simulado" + conexão.
- Layout: HUD → bloco do andar (cena 3D + painel lateral do robô) → tabela do andar → grade atual (Mesa IA: controles, gráfico, agentes, carteira, backtest, indicadores, notícias, log).
- `RobotsPanel`: usa a sala do andar atual e o store; botão "Ver" seleciona o robô; coluna de P&L segue a visão escolhida. Na Diretoria, lista todos os robôs.
- `RobotDetail`: nome, estratégia, ativo, status, P&L total/fechado/aberto/dia, último sinal + motivo, curva de patrimônio (lightweight-charts, linha), últimas ordens, pausar/retomar; para `mesa-ia`, aviso apontando para a linha do tempo. Selecionar robô também muda o `ticker` do store (gráfico/indicadores/notícias abaixo seguem o ativo).
- `AgentsBoard` perde o canvas (fica só o status em texto da Mesa IA).

### Task 5: Modelos — personagens e mobília escura
**Files:** `frontend/src/room/models3d.tsx`, `frontend/src/room/screens.ts`
- `Look` ganha `hair: string | null` (null = careca), `suit?: boolean` (paletó + lapela + gravata), `glasses?: boolean` (armação escura + lentes claras translúcidas).
- `DarkDesk` (tampo preto + filete dourado emissivo na borda), `ScreenMonitor` (tela com textura de canvas), `GoldStrip` (barra emissiva `toneMapped={false}`, cor > 1 para o bloom pegar).
- `screens.ts`: desenho em canvas — `drawSpark`, `drawEquityScreen` (telão da sala), `drawFloorBoard` (telão da Diretoria: barras por andar + ranking). Usam `normalizeSpark`.

### Task 6: Cena por andar, bloom e câmera
**Files:** `frontend/src/room/Room3D.tsx`, `frontend/src/room/floors/TradingFloor.tsx`, `frontend/src/room/floors/AgentIsland.tsx`, `frontend/src/room/floors/Boardroom.tsx`, `frontend/src/room/effects.tsx`, `frontend/src/room/layout3d.ts`, `frontend/src/room/RoomCanvas.tsx`
- `Room3D`: Canvas + `CameraRig` (OrbitControls ortográfico: sem rotação, pan limitado por `clampTarget`, zoom ×0,7–×2,5; desligado o amortecimento em movimento reduzido) + `Bloom` (composer com `UnrealBloomPass` limiar alto) + andar escolhido.
- `TradingFloor` (Ações): casca escura com filetes dourados, ilha da Mesa IA (`AgentIsland` = agentes, terminal, PARE, balões — código atual movido), uma mesa por robô de regras em `robotDesks`, operador sentado com `operatorLook`, monitores com a `spark`, placa HTML nome + P&L (clicável), telão com a curva da sala. Clique na mesa/operador → `select(id)`; mesa selecionada ganha anel dourado.
- `Boardroom` (Diretoria): mesa do CEO, CEO sentado, Gerente Geral em pé ao lado com balão `managerLine`, telão com patrimônio por andar + ranking, placas "CEO" e "Gerente Geral".
- As mesas por ticker antigas saem (substituídas pelas mesas por robô).

### Task 7: Docs e verificação real
- `docs/PROGRESSO.md` (seção Etapa 4, tecnologias, testes, mapa), `CLAUDE.md` §5/§9 (estrutura `office/`, `room/floors/`), `README.md` se citar a sala.
- `uv run pytest -q`, `ruff`, `black --check`, `npm test`, `npm run lint`, `npx tsc -b`, `npm run build`.
- Subir backend + frontend, abrir no navegador: trocar andares, clicar robô, alternar P&L, conferir números do 3D × tabela × `/api/rooms/acoes/robots`, screenshot, console sem erros.
