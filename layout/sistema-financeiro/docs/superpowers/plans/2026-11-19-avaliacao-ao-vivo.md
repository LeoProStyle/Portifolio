# Avaliação ao vivo (simulação com dados reais) — Plano

> Execução: superpowers:executing-plans (inline). Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** transformar o que já roda (robôs em contas simuladas com dados reais) numa **avaliação de verdade**: o sistema liga sozinho com o Windows, cada robô mostra **há quantos dias está ao vivo** (critério de 3 meses) e o seu resultado **comparado com comprar e segurar** o mesmo ativo desde o início da conta.

**Architecture:** (1) o backend passa a servir a tela já compilada (`frontend/dist`) na porta 8000, então um único processo basta; um script PowerShell inicia esse processo e outro registra/remove uma tarefa no Agendador de Tarefas do Windows (ao fazer logon). (2) e (3) são cálculos puros em `app/office/live.py` usados pela linha do robô (`/api/rooms/{sala}/robots`): dias ao vivo, faltam para 90, retorno do robô × retorno de comprar e segurar desde o início da conta (ação/cripto: variação do preço; minicontrato: 1 contrato), sempre com o último candle **completo** no instante (sem look-ahead).

**Tech Stack:** o que já existe (FastAPI StaticFiles, PowerShell `Register-ScheduledTask`). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-18-escritorio-pregao-design.md` §8 (critério de candidato: 3 meses ao vivo com a mesma configuração, bater o benchmark depois dos custos).

## Global Constraints
- Somente paper trading; textos sem promessa de lucro ("candidato" ≠ "pronto para conta real").
- Comprar e segurar começa no primeiro candle completo **depois** do início da conta e termina no último completo agora.
- Contar dias ao vivo pela execução atual (`runs.started_ts` da conta "live"); mudar a configuração zera a contagem (já é assim).
- Origem do WebSocket: aceitar também `http://localhost:8000` e `http://127.0.0.1:8000` (tela servida pelo backend).
- Scripts em PowerShell 5.1, sem segredos; remover a tarefa é um comando.

## Review Focus
1. Robô com conta aberta hoje (sem candle depois do início) → comprar e segurar `null`, nada de 0% inventado (Task 1).
2. Conta de minicontrato → comprar e segurar = 1 contrato em R$ sobre o capital (Task 1).
3. `frontend/dist` inexistente → backend sobe normal, só a API (Task 2).
4. Rotas `/api/*` e `/ws` continuam funcionando com a tela montada em `/` (Task 2).
5. Tarefa do Windows já registrada → script de instalação atualiza sem duplicar (Task 3).

---

### Task 1: Cálculo ao vivo (puro) + API
**Files:** `app/office/live.py`, `app/office/routes.py`, `app/main.py`, `tests/test_live.py`, `tests/test_api_office.py`
- `LIVE_TARGET_DAYS = 90`; `live_days(started_ts, now) -> int`.
- `hold_return(closes_after_start: list[float], multiplier: float | None, initial: float) -> float | None`: ação/cripto = último/primeiro − 1; contrato = (último − primeiro) × mult ÷ inicial; < 2 preços → `None`.
- Linha do robô ganha `live: {since, days, target_days, remaining_days, robot_return, hold_return, beats_hold}` (`beats_hold` = `None` sem dados).
- Router recebe uma função `candles_for(robot, at, lookback_days)` (o `load_candles` do motor) para não duplicar a lógica de proxy.

### Task 2: Backend serve a tela
**Files:** `app/main.py`, `app/config.py`, `.env.example`, `tests/test_api.py`
- Se `FRONTEND_DIST` (padrão `../frontend/dist`) existir: `StaticFiles(html=True)` montado em `/` depois de todas as rotas.
- `cors_origins` padrão inclui `http://localhost:8000` e `http://127.0.0.1:8000`.
- Testes: com uma pasta dist temporária, `GET /` devolve o `index.html` e `/health` continua JSON; sem a pasta, `GET /` → 404.

### Task 3: Ligar com o Windows
**Files:** `scripts/iniciar-escritorio.ps1`, `scripts/instalar-inicio-automatico.ps1`, `scripts/remover-inicio-automatico.ps1`, `README.md`
- `iniciar`: compila a tela se `dist` não existir, sobe `uv run uvicorn app.main:create_app --factory --port 8000` sem janela, log em `backend/logs/escritorio.log`; não sobe segundo processo se a porta 8000 já estiver em uso.
- `instalar`: `Register-ScheduledTask` "Escritorio de Pregao (simulacao)" ao fazer logon do usuário atual, `-Force` (atualiza sem duplicar); `remover`: `Unregister-ScheduledTask`.
- Verificação: rodar o instalador, conferir a tarefa com `Get-ScheduledTask`, disparar `Start-ScheduledTask` e abrir `http://localhost:8000`.

### Task 4: Tela
**Files:** `frontend/src/panels/robots.ts(+test)`, `RobotsPanel.tsx`, `RobotDetail.tsx`
- `liveLabel(live)`: "ao vivo há 12 dias · faltam 78 para 3 meses" / "3 meses completos".
- Tabela: coluna "Ao vivo" (dias); painel: retorno do robô × comprar e segurar desde o início, com aviso "candidato só depois de 3 meses e se bater o comprar e segurar depois dos custos".

### Task 5: Docs e verificação
- `PROGRESSO.md`, `README.md` (como ligar com o Windows); suítes; abrir `http://localhost:8000` servido pelo backend.
