# Robôs rastreadores (varredura) — Plano

> Execução: superpowers:executing-plans (inline) + TDD. Sem commits (o dono faz os próprios). Atualizar `docs/PROGRESSO.md` ao fim.

**Goal:** robôs que **escolhem entre vários ativos** (lista fixa e declarada) em cada sala — Ações, Minis e Cripto — para comparar, ao vivo e com dados reais, com os robôs de um ativo só. Somente simulação.

**Architecture:** robô com `universe` (lista de ativos) e `max_positions`. Todo dia, depois do fechamento, o passo de varredura (`engine/scanner.py`): (1) processa execuções/stop/alvo de todos os ativos da lista; (2) zera posições cujo sinal da estratégia mandou sair; (3) se há vagas e nenhuma ordem pendente, aplica a estratégia em todos os ativos, **ordena** os candidatos (`strategies/rank.py`: reversão por IFR → mais sobrevendido primeiro; demais → maior alta de 20 candles; minis: lado vendido pela série espelhada) e abre as melhores com o risco de sempre. Conta única por robô (o broker já guarda posições por ativo); minis com especificação de contrato **por ativo**.

**Tech Stack:** o que já existe. Nenhuma dependência nova.

## Global Constraints
- Lista fixa e declarada no `office.yaml` (evita viés de sobrevivência de "as melhores de hoje").
- Mesmas regras: só candles completos no instante; execução na abertura seguinte; custos; stop/alvo; risco por robô e do escritório; ordem pendente → não repetir.
- Robôs atuais **intactos** (hash igual: não zera a contagem dos 3 meses).
- Benchmark ao vivo do rastreador: **cesta igual** da lista (média do comprar e segurar de cada ativo; minis: média de 1 contrato).
- Backtest de rastreador fica para depois (resposta 400 clara).

## Review Focus
1. Nunca passa de `max_positions` (contando posições + ordens pendentes).
2. Ativo da lista sem dados → ignorado, o resto segue.
3. Minicontrato no rastreador usa o contrato do próprio ativo (WIN ≠ WDO).
4. Robôs de um ativo só não mudam (hash e comportamento).
5. Patrimônio marca todas as posições abertas com o último preço de cada ativo.

### Task 1: Config + `office.yaml` (universo das salas e 5 rastreadores)
### Task 2: `rank_candidates` (puro)
### Task 3: `FuturesBroker` com contrato por ativo
### Task 4: `scanner_step` (ações/cripto e minis) + ligação no passo
### Task 5: API (posições, cesta igual, backtest 400) + tela
### Task 6: Docs, suítes, verificação real (passo dos rastreadores com yfinance) e revisão independente
