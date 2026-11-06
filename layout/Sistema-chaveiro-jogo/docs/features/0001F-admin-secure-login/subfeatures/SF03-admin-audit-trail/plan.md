---
id: 0001F-SF03
type: feature-plan
created: 2026-11-06
updated: 2026-11-06
related: [0001F]
tags: [audit, admin, mongodb]
---

# Plan: 0001F — SF03 admin-audit-trail

> **Delivery:** confirm

## TL;DR
Plano do SF03 de 0001F-admin-secure-login, a última subfeature do epic. Um módulo `lib/admin-audit.ts` com uma função única de gravação (`recordAudit`) escreve cada login (`success`, `failure`, `locked`) e cada criação, edição e remoção de jogo ou cartucho na coleção `admin_audit` do MongoDB, sempre com uma linha `[audit]` no console. O registro só aceita uma lista fixa de campos: usuário, ação, tipo e id do alvo, data/hora, IP. Corpo, senha, hash e token não têm campo. Uma falha de gravação é logada e nunca bloqueia a ação. A coleção e os índices nascem pelo código, sem migração. 14 testes de contrato (10 unitários, 1 contra o MongoDB de teste, 3 E2E).

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Database](#database--sf03-admin-audit-trail)
- [Backend](#backend--sf03-admin-audit-trail)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

Once built: cada login e cada alteração bem-sucedida do catálogo deixa um documento em `admin_audit` com usuário, ação, alvo, data/hora e IP, e nenhum documento carrega corpo, senha, hash ou token.

## Context
{{doc:0001F}} define o epic; este plano cobre só `subfeatures/SF03-admin-audit-trail/about.md` (RF01-RF04, RN01-RN03). Base entregue: SF01 (`requireAdmin(request)` é a primeira instrução dos 10 handlers admin e devolve `guard.admin.id`, a identidade auditada), SF02 (`authorizeAdmin`/`checkCredentialsLock` emitem `success`, `failure` e `locked`; `getClientIp`; ruling: o usuário configurado nunca vai para log) e SF04 (handlers de jogo com `romPathForCreate`/`romPathForUpdate`, formatos de resposta mantidos). Este SF acrescenta a gravação durável sobre esses pontos e não muda nenhuma resposta HTTP.

## Global Constraints
- Node 24.x (AGENTS.md stack; package.json engines)
- `npm run build` exits 0 (AGENTS.md validation_gates.build)
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` exits 0 (AGENTS.md validation_gates.test)
- Camadas `app/**` → `components/**` → `lib/*` → `models/*`; imports só para dentro (AGENTS.md Architecture Contract)
- A linha `const guard = await requireAdmin(request)` continua a primeira instrução de cada handler admin (SF01 plan.md Guard Contract)
- Nenhum registro contém o corpo da requisição, senha, hash ou token (about.md RN01)
- O usuário configurado (`ADMIN_USERNAME`) nunca vai para log nem para auditoria; um nome digitado igual a ele vira `usernameMatched: true` (SF02 build-ledger ruling)
- Uma falha ao gravar a auditoria não desfaz nem bloqueia a ação do admin; o erro é logado (about.md RN03)
- `admin_audit` funciona em produção sem migração manual: coleção e índices criados pelo código, como `login_attempts` (user constraint, 2026-11-06)
- Testes nunca gravam no banco de `.env.local` (`MONGODB_DB` = produção); testes com Mongo usam `retrokey_e2e` e pulam quando `MONGODB_DB` não termina em `_e2e` (user constraint; tests/login-throttle-mongo.test.ts)
- Sem dependência nova (0001F about.md Decisions)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Uma função `recordAudit(entry, deps?)` que nunca lança: escreve `console.info('[audit] …', record)` primeiro, depois `insertOne` com limite de 3 s (`AUDIT_TIMEOUT_MS`); erro ou timeout → `console.error('[audit] write failed', {action, error: <nome da classe>})` | A linha de console existe mesmo com o Mongo fora; o admin não espera os 30 s do driver | Gravação fire-and-forget sem `await` — a Vercel congela a função depois da resposta e o insert se perde | about.md RN02, RN03 |
| `createAuditRecord` monta o documento campo a campo a partir de uma lista fixa; nunca espalha um objeto recebido | Um campo novo vindo de um chamador não chega ao Mongo | Gravar o objeto recebido e filtrar chaves proibidas — lista negra esquece um campo | about.md RN01 |
| Auditoria de login dentro de `lib/admin-login.ts`, no mesmo ponto que já chama `logOutcome`; o auditor entra em `AdminLoginDeps.audit` (padrão `recordAudit`) | Um ponto só decide o resultado e a identidade; os testes injetam um espião e nunca tocam o Mongo | Auditar no `auth.ts` ou na rota do nextauth — não veem `failure`/`locked` | about.md RF01; Global Constraint de testes |
| Identidade do login = a mesma do log `[auth]` do SF02: `success` → `user:'admin'`; nome digitado ≠ configurado → `user:<nome sem caracteres de controle, ≤64>`; nome digitado = configurado → `user:null, usernameMatched:true`; bloqueio por IP → `user:null, scope:'ip'` | RF04 permite o nome tentado; o ruling do SF02 proíbe o nome configurado em qualquer log | Gravar o nome digitado sempre — vaza o usuário real; gravar `'admin'` no lugar — confunde com quem digitou o literal `admin` | about.md RF04; SF02 build-ledger ruling |
| Handlers chamam `auditAdminAction(guard.admin, request, ação, alvo)` só no caminho 2xx, antes do `return`, nas duas vias (Mongo e memória) | Auditoria registra alterações que aconteceram; 404 e 500 não mudam o catálogo | Auditar toda chamada — enche a coleção de tentativas sem efeito, que o log `[api]` já cobre | about.md RF02 ("cada criação, edição e remoção") |
| `targetId` = id de negócio (`game-<ts>`, `cartridge-<ts>`, `params.id`), nunca o `_id` do Mongo; o POST calcula o id uma vez e usa no insert e na auditoria | É o id que as rotas `[id]` recebem; hoje o POST chama `Date.now()` duas vezes (`games/route.ts:67,70`) | `result.insertedId` — nenhuma rota busca por ele | about.md RF03 |
| Índices `{at:-1}` e `{targetType:1, targetId:1, at:-1}` criados uma vez por instância; falha do índice é logada, não impede o insert e limpa a promise em cache, então a próxima chamada tenta de novo, como `getMongoAttemptStore` [plan review A4] | Consulta por período e por alvo; a coleção nasce no primeiro `insertOne` | Script de migração — exige passo manual em produção | user constraint (sem migração manual) |
| Sem TTL | Retenção está fora do escopo (about.md Scope) | TTL de N dias — sem regra do dono | about.md Does NOT Include |

## Tasks
Test IDs (T01-T14) refer to the Test Specification below; execution IDs refer to `tasks.md` and are always written `tasks.md Txx`.
- [ ] test: `tests/admin-audit.test.ts` (T01-T05) red first with a throwing stub `lib/admin-audit.ts`; `tests/admin-login.test.ts` gains T06-T10 and injects an audit spy in every call (tasks.md T01, T02)
- [ ] test: `tests/admin-audit-mongo.test.ts` (T11), skipped unless `MONGODB_DB` ends in `_e2e` (tasks.md T03)
- [ ] e2e: `e2e/audit.qa.spec.ts` (T12, T13 `--project=main`; T14 `--project=no-mongo`) via qa-pipeline e2e-agent; names `e2e-sf03-*`, rows and records deleted at the end (tasks.md T04)
- [ ] backend: implement `lib/admin-audit.ts` — T01-T05, T11 green (tasks.md T05)
- [ ] backend: `lib/admin-login.ts` audits every `success`, `failure` and `locked` — T06-T10 green and SF02 tests still green (tasks.md T06)
- [ ] backend: the 6 mutation handlers call `auditAdminAction` on 2xx — T12, T14 green, SF01/SF04 E2E still green (tasks.md T07, T08)

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Um teste que use o auditor padrão com `--env-file=.env.local` grava em produção | M | linhas falsas na auditoria real | todo teste unitário injeta store em memória ou espião; só T11 usa o Mongo e pula fora de `*_e2e`; revisão de `tests/admin-login.test.ts` confere o helper `deps()` |
| Mongo lento soma até 3 s ao login e a cada ação admin | L | espera na tela | `AUDIT_TIMEOUT_MS = 3000`; o login já espera o throttle (até 2 × 5 s) |
| `npm run dev` local com `.env.local` grava auditoria no banco de produção | M | linhas de dev na auditoria real | mesmo comportamento atual do catálogo em dev; o E2E força `retrokey_e2e` (`playwright.config.ts:10-11`); registrado, sem mudança |
| Mudar `authorizeAdmin` quebra os testes do SF02 que contam linhas de log | M | regressão do SF02 | espião de auditoria sem console nos testes de login; `npm test` inteiro como verificação de tasks.md T06 |
| Editar os 6 handlers tira o guard do topo | L | API aberta | guard intocado; E2E SF01 `e2e/admin.qa.spec.ts` (T03, T11, T12) e SF04 `e2e/rom-path.qa.spec.ts` como regressão |
| No modo sem Mongo, cada ação admin loga `[audit] write failed` | H em dev sem Mongo | ruído no console | esperado por RN03; T14 confirma que a ação segue |
| Uma enxurrada de logins bloqueados (sem autenticação) grava um documento por requisição, sem teto, e cada uma espera até 3 s [plan review A3] | M | coleção cresce e o login fica mais lento sob ataque | aceito: retenção e limite de taxa estão fora do escopo (about.md Does NOT Include); o teto por IP do SF02 continua barrando o scrypt; índices só nos campos de consulta |
| O 0002F SF03 (admin-customization) exclui a auditoria de temas e diz que ela "fica com o 0001F SF03", mas este SF só cobre jogos e cartuchos | M | alterações de tema sem auditoria | `AuditTarget.type` é uma união fechada que o 0002F SF03 estende com o seu tipo e chama `auditAdminAction` nos seus handlers; registrado para o plano do 0002F |

## Validation
- `npm run build` exit 0
- `npm test` exit 0 (T01-T10 e todos os testes do SF01/SF02/SF04; T11 pula sem `*_e2e`)
- `$env:MONGODB_DB='retrokey_e2e'; node --env-file=.env.local --import tsx --test tests/admin-audit-mongo.test.ts` verde (T11)
- E2E, um projeto por vez, `.next` apagado antes, portas 3001/3002 livres: `npx playwright test --project=main` (T12, T13 + regressão SF01/SF02/SF04), depois `npx playwright test --project=no-mongo` (T14 + SF01 T17 + SF04 T09)
- Manual (o dono roda, leitura do banco de produção bloqueada para o agente): depois do deploy, um login e uma edição de jogo → `db.admin_audit.find().sort({at:-1}).limit(2)` mostra os dois documentos sem campos fora da lista

---

## Test Specification

Scope: SF03. Unit = `npm test` (dependências injetadas: store, relógio, timeout, auditor); Mongo = `tests/admin-audit-mongo.test.ts` só em `*_e2e`; E2E = `npx playwright test e2e/audit.qa.spec.ts`, que lê `admin_audit` no `retrokey_e2e` com o driver `mongodb` a partir do processo de teste.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Record keeps only whitelisted fields | backend | RN01, RF03 | entry plus `body`, `password`, `hash`, `token`, `cookie` keys | keys ⊆ `user, action, targetType, targetId, at, ip, usernameMatched, scope`; `at` = injected now | key set + values |
| T02 | User and IP text sanitized | backend | RN01, RF04 | user `'evil\nname\u0007'`, 300-char user, 300-char `ip` with control chars | control chars removed; `user` and `ip` length ≤ 64; `null` user stays `null` | strict equality |
| T03 | recordAudit logs and inserts | backend | RF03, RN02 | memory store, one entry | one `console.info` starting `[audit]` with the record; store holds one equal record | spy + store |
| T04 | Store failure never throws | backend | RN03, RN02 | store throws; store hangs (timeout 20 ms) | resolves; `[audit]` info line present; one `console.error('[audit] write failed', {action, error})` with no record values | resolves + spy |
| T05 | Admin action entry from guard identity | backend | RF02, RF03, RF04 | `auditAdminAction({id:'admin',…}, Request x-forwarded-for '1.2.3.4', 'delete', {type:'game', id:'game-1'})` | record `{user:'admin', action:'delete', targetType:'game', targetId:'game-1', ip:'1.2.3.4'}` | deep equal (minus `at`) |
| T06 | Successful login audited with session id | backend | RF01, RF04 | right credentials | audit `{user:'admin', action:'login.success', targetType:'login', targetId:null, ip}` | spy entry |
| T07 | Failed login audited with typed name rule | backend | RF01, RF04, RN01 | wrong password as `intruder`; wrong password as the configured name | `user:'intruder'`; `user:null, usernameMatched:true` | spy entries |
| T08 | Locked logins audited | backend | RF01 | user+IP lock via `authorizeAdmin`, via `checkCredentialsLock`, IP lock (31 rotating names) | `action:'login.locked'` each; IP lock `user:null, scope:'ip'` | spy entries |
| T09 | Audit failure keeps login result | backend | RN03 | audit spy rejects; right and wrong credentials | `AdminUser` and `null` as without audit | return value |
| T10 | No audit entry carries secrets | backend | RN01 | T06-T08 runs | no entry contains the password, the hash or the configured username | substring scan of JSON |
| T11 | Mongo store inserts and builds indexes | database | RF01, RF02, RF03 | `retrokey_e2e`, two records `e2e-sf03-*` | both found with every whitelisted field (plus Mongo `_id`); `listIndexes` has `at_-1` and `targetType_1_targetId_1_at_-1` | find + indexes |
| T12 | Every catalog change leaves one row | backend | RF02, RF03, RF04, RN01 | admin: create, edit, delete game `e2e-sf03-*`; create, edit (PUT), delete cartridge | 6 rows `{user:'admin', action, targetType, targetId}` matching the ids, `ip` and `at` set; keys ⊆ `user, action, targetType, targetId, at, ip` plus Mongo `_id`, no other keys [plan review A1] | Mongo query in test |
| T13 | Logins leave rows | backend | RF01, RF04 | admin login; wrong login as `e2e-sf03-<ts>` | `login.success` with `user:'admin'` after test start; `login.failure` with `user:'e2e-sf03-<ts>'`, `targetType:'login'`, `targetId:null` | Mongo query in test |
| T14 | Action succeeds when audit cannot write | backend | RN03 | no-mongo project: admin POST game `e2e-sf03-*`, then GET list on the same route | 201; list contains the game | status + list |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | tests/admin-audit.test.ts | T01, T02, T03, T04, T05 |
| backend | tests/admin-login.test.ts (extended) | T06, T07, T08, T09, T10 |
| database | tests/admin-audit-mongo.test.ts (skips outside `*_e2e`) | T11 |
| backend (E2E) | e2e/audit.qa.spec.ts | T12, T13 (`--project=main`), T14 (`--project=no-mongo`) |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|--------|
| RF01 | T06, T07, T08, T11, T13 | ✅ |
| RF02 | T05, T11, T12 | ✅ |
| RF03 | T01, T03, T05, T11, T12 | ✅ |
| RF04 | T02, T05, T06, T07, T12, T13 | ✅ |
| RN01 | T01, T02, T07, T10, T12 | ✅ |
| RN02 | T03, T04 | ✅ |
| RN03 | T04, T09, T14 | ✅ |

---

## Database — SF03 admin-audit-trail

### Entities
| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| AdminAuditRecord | `admin_audit` | `user: string \| null`, `action: AuditAction`, `targetType: 'login' \| 'game' \| 'cartridge'`, `targetId: string \| null`, `at: Date`, `ip: string`, optional `usernameMatched: true`, optional `scope: 'ip'` | Similar: `AttemptRecord` / `login_attempts` in `lib/login-throttle.ts` |

`AuditAction = 'login.success' | 'login.failure' | 'login.locked' | 'create' | 'update' | 'delete'`. Login rows: `targetType:'login'`, `targetId:null` (RF04).

### Migration
- None. The collection is created by the first `insertOne`; `getMongoAuditStore` calls `createIndex({at:-1})` and `createIndex({targetType:1, targetId:1, at:-1})` once per instance (idempotent), as `getMongoAttemptStore` does (`lib/login-throttle.ts:133-139`). No TTL.

### Repository
| Method | Purpose |
|--------|---------|
| `AuditStore.insert(record)` | one `insertOne` per event |
| `getMongoAuditStore()` | collection `admin_audit` + indexes once per instance; an index error is logged (`[audit] index failed`), the cached index promise is cleared so the next call retries, and the store is still returned |
| `createMemoryAuditStore()` | in-process array for unit tests |

---

## Backend — SF03 admin-audit-trail

Stack: Next 14.2.15 route handlers (Node runtime), raw mongodb v7, no DI, no validation lib. Impact NOT VERIFIED by GitNexus (git root two levels up, symbols unmapped); text search: `authorizeAdmin` ← `auth.ts:17` only; `checkCredentialsLock` ← `app/api/auth/[...nextauth]/route.ts:10` only; the 6 mutation handlers ← `components/admin/GamesTab.tsx`, `components/admin/CartridgesTab.tsx` and the E2E specs.

### Endpoints
No endpoint added; status codes and bodies unchanged. Audited on 2xx only:

| Method | Path | action | targetType | targetId |
|---|---|---|---|---|
| POST | /api/admin/games | create | game | the `id` written (`game-<ts>`, computed once) |
| PUT | /api/admin/games/[id] | update | game | `params.id` |
| DELETE | /api/admin/games/[id] | delete | game | `params.id` |
| POST | /api/admin/cartridges | create | cartridge | the `id` written (`cartridge-<ts>`, computed once) |
| PUT | /api/admin/cartridges/[id] | update | cartridge | `params.id` |
| DELETE | /api/admin/cartridges/[id] | delete | cartridge | `params.id` |
| POST | /api/auth/callback/credentials | login.success / login.failure / login.locked | login | null |

`targetId` is stored as is: on a 2xx it is either generated by the server (POST) or the `params.id` that just matched a stored record (PUT/DELETE). A PUT that matches a record answers 200 even when no value changed (`matchedCount`, not `modifiedCount`), and it is audited as `update`: the admin did submit an edit. [readback]

### DTOs / Types (`lib/admin-audit.ts`)
| DTO | Fields | Notes |
|---|---|---|
| AdminAuditRecord | see Database | written to Mongo and to the `[audit]` console line |
| AuditEntry | `Omit<AdminAuditRecord, 'at'>` | input of `recordAudit` |
| AdminAction | `'create' \| 'update' \| 'delete'` | handler actions |
| AuditTarget | `{ type: 'game' \| 'cartridge'; id: string }` | handler target |
| AuditStore | `{ insert(record: AdminAuditRecord): Promise<void> }` | Mongo or memory |
| AuditDeps | `{ getStore?: () => Promise<AuditStore>; now?: () => Date; timeoutMs?: number }` | defaults: `getMongoAuditStore`, `() => new Date()`, `AUDIT_TIMEOUT_MS` (3000) |

### Modules
- `lib/admin-audit.ts` (Node; imports `lib/mongo`, `lib/request-ip`, type `AdminIdentity` from `lib/auth-guard`): constants `ADMIN_AUDIT_COLLECTION = 'admin_audit'`, `AUDIT_TIMEOUT_MS = 3000`; `createAuditRecord(entry: AuditEntry, now: Date): AdminAuditRecord` (copies only the listed fields; `user` and `ip` stripped of control characters and cut to 64 chars — `ip` comes from the client-controlled `x-forwarded-for` [plan review A2]; `usernameMatched`/`scope` only when `true`/`'ip'`); `recordAudit(entry: AuditEntry, deps?: AuditDeps): Promise<void>` (never rejects; console line first, then insert under the timeout; getting the store counts toward the timeout); `auditAdminAction(admin: AdminIdentity, request: Request, action: AdminAction, target: AuditTarget, deps?: AuditDeps): Promise<void>` (`user = admin.id`, `ip = getClientIp(request.headers)`); `getMongoAuditStore(): Promise<AuditStore>`; `createMemoryAuditStore(): AuditStore & { records: AdminAuditRecord[] }`.
- `lib/admin-login.ts`: `AdminLoginDeps` gains `audit?: (entry: AuditEntry) => Promise<void>` (default `recordAudit`). `logOutcome` becomes `reportOutcome`: logs `[auth]` exactly as today and then awaits `audit(...)` with the identity mapped as the Architecture Decisions row says. Covers every current `logOutcome` call: oversized input and wrong credentials (`failure`), IP lock and user+IP lock in `authorizeAdmin` and in `checkCredentialsLock` (`locked`), success. `disabled` stays a `console.error` only. A rejected audit promise is caught; the return value never changes (T09).
- Handlers (`app/api/admin/games/route.ts`, `games/[id]/route.ts`, `cartridges/route.ts`, `cartridges/[id]/route.ts`): after the write succeeds and before the 2xx `return`, `await auditAdminAction(guard.admin, request, <action>, {type, id})`, in both the Mongo and the in-memory branch of the game handlers. The guard lines and the response bodies stay as they are.

### Files
{"files":{"create":["lib/admin-audit.ts","tests/admin-audit.test.ts","tests/admin-audit-mongo.test.ts","e2e/audit.qa.spec.ts"],"modify":["lib/admin-login.ts","tests/admin-login.test.ts","app/api/admin/games/route.ts","app/api/admin/games/[id]/route.ts","app/api/admin/cartridges/route.ts","app/api/admin/cartridges/[id]/route.ts"]}}

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Contract tests | tasks.md execution |
|----|-------------|----------|--------------|----------------|--------------------|
| RF01 | Login sucesso, falho e bloqueado em `admin_audit` | YES | Backend + Database + E2E | T06-T08, T11, T13 | tasks.md T02, T03, T04, T05, T06 |
| RF02 | Criar, editar e remover jogo ou cartucho em `admin_audit` | YES | Backend + Database + E2E | T05, T11, T12 | tasks.md T01, T03, T04, T05, T07, T08 |
| RF03 | Usuário, ação, tipo e id do alvo, data/hora, IP de `getClientIp` | YES | Backend | T01, T03, T05, T11, T12 | tasks.md T01, T05, T07, T08 |
| RF04 | Login: alvo `login`/`null`; ação admin: id da sessão; falha/bloqueio: nome tentado | YES | Backend | T02, T05-T07, T12, T13 | tasks.md T01, T02, T05, T06 |
| RN01 | Sem corpo, senha, hash ou token | YES | Backend | T01, T02, T07, T10, T12 | tasks.md T01, T02, T05, T06 |
| RN02 | Toda gravação também sai no console com `[audit]` | YES | Backend | T03, T04 | tasks.md T01, T05 |
| RN03 | Falha da auditoria não bloqueia a ação; erro logado | YES | Backend + E2E | T04, T09, T14 | tasks.md T01, T02, T04, T05, T06, T07 |
| Scope | Coleção `admin_audit` e uma função única de gravação | YES | Database + Backend | T03, T11 | tasks.md T05 |
| Scope | Chamadas nos handlers admin e no fluxo de login | YES | Backend | T06-T08, T12 | tasks.md T06, T07, T08 |

Coverage: 100% (7/7 requirements + 2 scope items). Excluded per about.md: tela de consulta, alertas, retenção.

## Overview
O SF03 dá ao dono um histórico durável do admin. Hoje o único registro é a linha `[auth]` no console, que expira nos logs da Vercel. Depois dele, cada login e cada alteração do catálogo fica em `admin_audit`, consultável direto no MongoDB, sem nada que permita reconstruir uma senha ou o usuário real.

## Main Flow
1. Admin → POST `/api/auth/callback/credentials` → `checkCredentialsLock` → bloqueado → `reportOutcome('locked')` → `[auth]` + `recordAudit` → 429.
2. Não bloqueado → `authorizeAdmin` → resultado `success`/`failure`/`locked` → `reportOutcome` → `[auth]` + `[audit]` + `insertOne` (até 3 s) → resposta do NextAuth.
3. Admin → POST/PUT/DELETE em `/api/admin/{games,cartridges}` → `requireAdmin` → escrita no Mongo ou na memória → `auditAdminAction(guard.admin, request, ação, alvo)` → resposta 2xx inalterada.
4. Mongo fora → `[audit]` no console + `[audit] write failed` → a ação já feita responde normalmente.

## Implementation Order
Test (tasks.md T01-T04, red) → Database + Backend (tasks.md T05 `lib/admin-audit.ts`) → Backend login (tasks.md T06) → Backend handlers (tasks.md T07 jogos → T08 cartuchos). Não há frontend.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Mongo store with lazy index | `getMongoAttemptStore` in `lib/login-throttle.ts` |
| Store timeout | `withStore` in `lib/admin-login.ts` |
| Login outcome log | `logOutcome` / `logIdentity` in `lib/admin-login.ts` |
| Guard identity | `requireAdmin` / `AdminIdentity` in `lib/auth-guard.ts` |
| Client IP | `getClientIp` in `lib/request-ip.ts` |
| Mongo test guard | `isTestDatabase` in `tests/login-throttle-mongo.test.ts` |
| E2E helpers | `adminApi`, `createGame`, `createCartridge`, `cleanup` in `e2e/admin.qa.spec.ts` |
