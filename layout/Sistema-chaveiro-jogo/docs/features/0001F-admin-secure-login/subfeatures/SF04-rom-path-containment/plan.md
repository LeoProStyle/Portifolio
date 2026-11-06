---
id: 0001F-SF04
type: feature-plan
created: 2026-11-06
updated: 2026-11-06
related: [0001F]
tags: [rom, path-traversal, security, admin]
---

# Plan: 0001F — SF04 rom-path-containment

> **Delivery:** confirm

## TL;DR
Plano do SF04 de 0001F-admin-secure-login. Um módulo puro `lib/rom-path.ts` classifica cada `romPath` como chave R2 (formato exato de `buildRomObjectKey`), arquivo local contido em `public/roms`, ou recusado. A rota pública `/api/rom/[slug]` só lê o que foi aceito e responde 404 ao resto, sem ecoar o caminho. Os handlers de jogo ignoram `romPath` do corpo: criação sem arquivo grava vazio, edição sem arquivo preserva o valor gravado. A aba de jogos mostra o caminho só para leitura. 8 testes de contrato (6 unitários, 2 E2E).

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Backend](#backend--sf04-rom-path-containment)
- [Frontend](#frontend--sf04-rom-path-containment)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

Once built: nenhum `romPath` gravado, nem mesmo por uma sessão de admin abusada, faz a rota pública de ROM ler um arquivo fora de `public/roms` ou uma chave R2 fora de `roms/<slug>.<ext>`.

## Context
{{doc:0001F}} define o epic; este plano cobre só `subfeatures/SF04-rom-path-containment/about.md` (RF01-RF06, RN01-RN03). RN03 foi endurecido no about.md junto com este plano: chave R2 aceita só no formato exato de `buildRomObjectKey` (consequência direta do RN02, "todo o resto não é lido"). Base entregue: SF01 (guard `requireAdmin` como primeira instrução dos 10 handlers admin, que este SF não toca) e SF02 (login). SF03 (pendente) vai auditar as mesmas ações de jogo; este SF não muda a forma das respostas dos handlers.

## Global Constraints
- Node 24.x (AGENTS.md stack; package.json engines)
- `npm run build` exits 0 (AGENTS.md validation_gates.build)
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` exits 0 (AGENTS.md validation_gates.test)
- `/api/rom/[slug]` continua acessível sem login (about.md RN01)
- A linha `const guard = await requireAdmin(request)` continua a primeira instrução de cada handler admin (SF01 plan.md Guard Contract)
- Sem dependência nova (0001F about.md Decisions)
- Texto da tela em português (.codeadd/wiki/conventions.md UI language)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Classificação num módulo puro `lib/rom-path.ts` com `publicDir` injetável | Testável com node:test sem servidor nem disco real | Lógica dentro da rota | about.md Success Metrics (`tests/rom-path.test.ts`) |
| Chave R2 aceita só no formato exato `roms/<slug>.<ext>` (`^roms/[a-z0-9-]+\.[a-z0-9]+$`, o que `buildRomObjectKey` gera) | Uma chave como `roms/../rooms.json` ou outra pasta do bucket nunca é pedida ao R2 | Aceitar qualquer `roms/…` (texto do RN03) — deixa o resto do bucket alcançável | about.md RN03 endurecido; RN02 "todo o resto não é lido" |
| Local só com `/` inicial: `/roms/x` resolvido com `path.resolve(publicDir, …)` precisa ficar dentro de `public/roms` + separador; nome sem byte nulo | Contenção pelo caminho resolvido, não por texto | Bloquear só `..` por texto — escapa por codificação e separadores | about.md RN02, RN03 |
| `romPath` sem `/` que começa com `roms/` é R2; com `/roms/` é local | Corrige o bug atual: a rota tira o `/` e manda `/roms/x` (fallback local de `uploadRomToR2`) para o R2 (`app/api/rom/[slug]/route.ts:94-99`) | Manter a normalização atual | about.md RN03 |
| Resposta 404 genérica sem ecoar o caminho recusado; o log `[rom]` leva só slug e motivo | O corpo atual devolve o `romPath` em `details` (`route.ts:114,139`) | Manter `details` | about.md RN02 |
| Handlers: `romPathForCreate(uploaded)` e `romPathForUpdate(uploaded)` puros; nunca leem `body.romPath` | Uma regra para POST/PUT, multipart e JSON, nas duas vias (Mongo e memória) | Editar cada ramo à mão | about.md RF02, RF05 |
| Campo `romPath` da aba de jogos vira só leitura | O admin não digita caminho; o upload gera | Remover a linha do caminho atual | about.md RF04 |

## Tasks
Test IDs (T01-T08) refer to the Test Specification below; execution IDs refer to `tasks.md` and are always written `tasks.md Txx`.
- [ ] TASK-1 test: `tests/rom-path.test.ts` (T01-T06) red first, with a stub `lib/rom-path.ts` (tasks.md T01)
- [ ] TASK-2 e2e: `e2e/rom-path.qa.spec.ts` (T07, T08) via qa-pipeline e2e-agent; same `playwright.config.ts` projects as SF01/SF02; slugs `e2e-sf04-*`, deleted at the end (tasks.md T02)
- [ ] TASK-3 backend: implement `lib/rom-path.ts` — T01-T06 green (tasks.md T03)
- [ ] TASK-4 backend: `/api/rom/[slug]` uses `classifyRomPath`; 404 without echo — T07 green (tasks.md T04)
- [ ] TASK-5 backend: game handlers POST/PUT use `romPathForCreate`/`romPathForUpdate`, ignore `body.romPath` — T08 green (tasks.md T05)
- [ ] TASK-6 frontend: `GamesTab` shows `romPath` read-only (tasks.md T06)

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Jogos legados com `romPath` em texto livre ou fora dos formatos param de carregar | M | jogo some do emulador | 404 com log `[rom]`; o admin reenvia o arquivo na edição (RF06); excluído do escopo migrar o banco |
| Chave R2 legada fora do formato `roms/<slug>.<ext>` passa a 404 | L | jogo some | `buildRomObjectKey` sempre gerou esse formato; mesmo caminho de recuperação (RF06) |
| Hoje o PUT grava `romPath ?? body.romPath`: uma edição JSON sem o campo grava `undefined` | M | perder o caminho numa edição | `romPathForUpdate(undefined)` devolve `{}` e o `$set` não inclui `romPath` (T05) |
| Editar os handlers de jogos quebra o guard do SF01 | L | API aberta | guard intocado; E2E SF01 T03/T11/T12 como regressão; T12 envia `romPath: ''` no corpo (`e2e/admin.qa.spec.ts:327,335`) e não afirma o valor gravado, então o descarte do campo não muda o resultado; se alguma asserção de T12 depender de `romPath` do corpo, ajustá-la dentro de tasks.md T05 para esperar `''` na criação |
| Em dev os bundles de rota têm arrays em memória separados (SF01 ruling) | H | E2E de PUT sem Mongo não enxerga o POST | T08 checa POST + GET na mesma rota; PUT coberto pelo unitário T06 |
| `active` chega como texto `'true'`/`'false'` e é gravado sem conversão (0002F discovery) | M | jogo inativo continua jogável | fora deste SF; registrado para um hotfix ou subfeature futura |

## Validation
- `npm run build` exit 0
- `node --import tsx --test "tests/*.test.ts"` (o script `npm test` do package.json) exit 0, incluindo `tests/rom-path.test.ts` (T01-T06) e os testes do SF01/SF02
- `npx playwright test e2e/rom-path.qa.spec.ts --project=main` verde (T07, T08)
- `npx playwright test e2e/admin.qa.spec.ts --project=main` continua verde (regressão SF01)
- Manual: no admin, editar um jogo sem escolher arquivo mantém o "Caminho atual da ROM"; reenviar o arquivo gera `roms/<slug>.<ext>` (ou `/roms/<slug>.<ext>` sem R2)
- Manual (ramo recusado, que os handlers já não deixam gravar): pôr `romPath: '../.env'` num jogo direto no Mongo ou no array de `lib/admin-store.ts`, chamar `GET /api/rom/<slug>` sem login → 404 `{error:'ROM not found'}`, log só com slug e motivo

---

## Test Specification

Scope: SF04. Unit = `npm test`; E2E = `npx playwright test e2e/rom-path.qa.spec.ts`. `publicDir` injected; no test reads a real secret file.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | R2 key in builder format accepted | backend | RN03 | `roms/super-mario.nes`, `roms/a.zip`, and every `buildRomObjectKey` output for the `tests/r2-rom.test.ts` inputs plus `("Super Mario!", "GAME.NES")` and `("", "x")` | `{kind:'r2', key}` with the same string | deep equal |
| T02 | Local path inside public/roms accepted | backend | RN02 | `/roms/super-retro.bin` and `/roms/..%2f.env` (literal name, `%` not decoded) with `publicDir=/tmp/pub` | `{kind:'local', absolutePath}` where the test computes `path.resolve('/tmp/pub', 'roms', <name>)` | deep equal |
| T03 | Traversal and absolute paths rejected | backend | RF03, RN02 | `/roms/../.env`, `/../.env`, `../.env`, `/etc/passwd`, `C:\\x`, `/roms/a\0.bin`, `/roms/` | `{kind:'rejected'}` for each | kind |
| T04 | R2-looking keys outside builder format rejected | backend | RN03 | `roms/../rooms.json`, `roms/sub/x.bin`, `roms/X.BIN`, `/roms` | `{kind:'rejected'}` | kind |
| T05 | Empty or non-string romPath rejected | backend | RF03 | `''`, `undefined`, `42` | `{kind:'rejected'}` | kind |
| T06 | Write helpers never take romPath from the body | backend | RF01, RF02, RF05, RF06 | `romPathForCreate(undefined)`, `romPathForCreate('roms/a.nes')`, `romPathForUpdate(undefined)`, `romPathForUpdate('/roms/a.nes')` | `''`, `'roms/a.nes'`, `{}`, `{romPath:'/roms/a.nes'}` | deep equal |
| T07 | ROM route stays public and does not echo paths | backend | RN01, RF03 | anonymous GET `/api/rom/super-retro` (mock, `/roms/super-retro.bin`, file absent) and `/api/rom/does-not-exist` | 404 `{error:'ROM not found'}` and 404 `{error:'Game not found'}`; never 401/403; no body carries a path | status + exact body |
| T08 | Body romPath ignored on create | backend | RF02 | admin POST JSON `{slug:'e2e-sf04-…', romPath:'../.env'}`, then admin GET list | created game has `romPath: ''` | list entry |
| T09 | Edit without file keeps romPath, body romPath ignored (added by the build's final review, FR-2) | backend | RF02, RF05 | no-mongo project: admin PUT `game-1` JSON and multipart without `romFile`, each with `romPath:'../.env'`, then admin GET `game-1` | `romPath` stays `/roms/super-retro.bin` | GET body |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | tests/rom-path.test.ts | T01, T02, T03, T04, T05, T06 |
| backend (E2E) | e2e/rom-path.qa.spec.ts | T07, T08 (`--project=main`), T09 (`--project=no-mongo`) |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|--------|
| RF01 | T06 | ✅ |
| RF02 | T06, T08 | ✅ |
| RF03 | T03, T05, T07 | ✅ |
| RF04 | T06 + manual (upload in GamesTab) | ✅ |
| RF05 | T06 | ✅ |
| RF06 | T06 | ✅ |
| RN01 | T07 | ✅ |
| RN02 | T02, T03 | ✅ |
| RN03 | T01, T04 | ✅ |

---

## Backend — SF04 rom-path-containment

Stack: Next 14.2.15 route handlers (Node runtime), raw mongodb v7, `lib/admin-store.ts` in-memory fallback. Graph: `uploadRomToR2` ← the two game handlers; `buildRomObjectKey` ← `uploadRomToR2`, `saveRomFileLocally`, `tests/r2-rom.test.ts`.

### Endpoints
| Method | Path | Request DTO | Response DTO | Status | Purpose |
|---|---|---|---|---|---|
| GET | /api/rom/[slug] | — | ROM bytes, or `{error}` | 200 / 404 / 500 (500 only for an unexpected error in the outer catch, unchanged) | public; reads only an accepted `romPath` |
| POST | /api/admin/games | multipart with `romFile`, or JSON | unchanged | 201 / 401 / 403 / 500 | `romPath` from the upload only; `''` without file |
| PUT | /api/admin/games/[id] | multipart with optional `romFile`, or JSON | unchanged | 200 / 401 / 403 / 404 / 500 | `romPath` changes only when a file is uploaded |

### Types
| Type | Fields | Notes |
|---|---|---|
| RomLocation | `{ kind: 'r2'; key: string } \| { kind: 'local'; absolutePath: string } \| { kind: 'rejected'; reason: 'empty' \| 'format' \| 'outside-roms' }` | `lib/rom-path.ts` |
| RomNotFound response | `{ error: 'ROM not found' }` | replaces the bodies at `route.ts:84-87,112-115,137-140` that echo `romPath`/`localPath` |

### Modules
- `lib/rom-path.ts` (Node, imports only `node:path`): `R2_ROM_KEY = /^roms\/[a-z0-9-]+\.[a-z0-9]+$/`; `classifyRomPath(romPath: unknown, publicDir?: string): RomLocation` (default `path.join(process.cwd(), 'public')`); rules in order: non-string or empty → `empty`; contains `\0` or `\\` → `format`; matches `R2_ROM_KEY` → `r2`; starts with `/roms/` → `const roms = path.resolve(publicDir ?? path.join(process.cwd(), 'public'), 'roms')`, `absolutePath = path.resolve(roms, '.' + romPath.slice('/roms'.length))`, accepted only if `absolutePath.startsWith(roms + path.sep)` → `local`, else `outside-roms`; anything else → `format`. `%` sequences are not decoded: `/roms/..%2f.env` is a literal file name inside `public/roms` and classifies as `local`. `romPathForCreate(uploaded: string | undefined): string` → `uploaded ?? ''`. `romPathForUpdate(uploaded: string | undefined): { romPath?: string }` → `uploaded === undefined ? {} : { romPath: uploaded }`.
- `app/api/rom/[slug]/route.ts`: replace the normalize/`startsWith('roms/')`/`path.join` block (`:91-142`) with `classifyRomPath(game.romPath)`; `r2` → `fetchRomFromR2(key)`; `local` → `fs.readFileSync(absolutePath)`; `rejected` → `console.warn('[rom] rejected romPath', { slug, reason })` and 404 `RomNotFound`. Read failures (R2 null, file missing) also return `RomNotFound`, logging slug only. Inactive/missing game keeps `{error:'Game not found'}` 404. Route stays without `auth()`.
- `uploadedPath` = o valor que `uploadRomToR2` (`lib/r2.ts:117-150`, sem mudança) já devolve hoje nos dois handlers: a chave R2 `roms/<slug>.<ext>`, ou `/roms/<slug>.<ext>` quando cai no fallback local; `undefined` quando não veio `romFile`. Vale nas duas vias de cada handler (Mongo e `getAdminGamesStore()`).
- `app/api/admin/games/route.ts` POST: `romPath: romPathForCreate(uploadedPath)`; JSON branch no longer reads `body.romPath`; `newGame` drops `body.romPath`.
- `app/api/admin/games/[id]/route.ts` PUT: `...romPathForUpdate(uploadedPath)` spread into `$set` and into the in-memory `Object.assign`, replacing `romPath: romPath ?? body.romPath` (`:66`, `:93`).

### Files
{"files":{"create":["lib/rom-path.ts","tests/rom-path.test.ts","e2e/rom-path.qa.spec.ts"],"modify":["app/api/rom/[slug]/route.ts","app/api/admin/games/route.ts","app/api/admin/games/[id]/route.ts","components/admin/GamesTab.tsx"]}}

---

## Frontend — SF04 rom-path-containment

### Components
{"GamesTab(modified)":{"location":"components/admin/GamesTab.tsx","purpose":"romPath input (:196-197) becomes read-only text 'Caminho atual da ROM' shown only when non-empty; the FormData loop (:82-89) skips the romPath key so the form no longer sends it; romFile upload unchanged"}}

Reference: `components/admin/GamesTab.tsx:82-98` (FormData build), `:196-216` (romPath input and current-path line).

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Contract tests | tasks.md execution |
|----|-------------|----------|--------------|----------------|--------------------|
| RF01 | `romPath` gerado no servidor via `buildRomObjectKey` | YES | Backend | T06 | tasks.md T01, T03, T05 |
| RF02 | `romPath` do corpo ignorado | YES | Backend + Frontend | T06, T08 | tasks.md T01, T02, T05, T06 |
| RF03 | Rota de ROM só lê `romPath` aceito; resto 404 | YES | Backend | T03, T05, T07 | tasks.md T01, T02, T03, T04 |
| RF04 | Arquivo vem do `romFile` multipart | YES | Backend + Frontend | T06 + manual | tasks.md T05, T06 |
| RF05 | PUT sem arquivo preserva `romPath` | YES | Backend | T06 | tasks.md T01, T03, T05 |
| RF06 | Reenviar arquivo gera `romPath` novo | YES | Backend | T06 | tasks.md T01, T03, T05 |
| RN01 | `/api/rom/[slug]` sem login | YES | Backend | T07 | tasks.md T02, T04 |
| RN02 | Local só dentro de `public/roms` | YES | Backend | T02, T03 | tasks.md T01, T03, T04 |
| RN03 | `roms/<slug>.<ext>` exato = R2; `/roms/` = local | YES | Backend | T01, T04 | tasks.md T01, T03, T04 |

Coverage: 100% (9/9).

## Overview
O SF04 fecha a leitura de arquivos do servidor pela rota pública de ROM. Hoje um `romPath` gravado pela API admin vai direto para `readFileSync`, e o caminho `/roms/x` do fallback local é tratado como chave R2. Depois dele, só dois formatos são lidos: a chave R2 que o próprio servidor gera e um arquivo dentro de `public/roms`.

## Main Flow
1. Admin → envia jogo com arquivo → handler chama `uploadRomToR2` → `romPathForCreate`/`romPathForUpdate` grava `roms/<slug>.<ext>` ou `/roms/<slug>.<ext>`.
2. Admin → envia jogo sem arquivo ou com `romPath` no corpo → o corpo é ignorado; criação grava `''`, edição mantém o valor.
3. Jogador → emulador pede `/api/rom/<slug>` sem login → `classifyRomPath` → `r2` busca no R2, `local` lê o arquivo contido.
4. `romPath` recusado → log `[rom] rejected romPath {slug, reason}` → 404 `{error:'ROM not found'}`.

## Implementation Order
Test (tasks.md T01, T02, red) → Backend (tasks.md T03 módulo → T04 rota de ROM → T05 handlers) → Frontend (tasks.md T06 aba de jogos).

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Key builder | `buildRomObjectKey` em `lib/r2.ts` |
| Upload | `uploadRomToR2` em `lib/r2.ts` |
| ROM route | `app/api/rom/[slug]/route.ts` |
| Game handlers | `app/api/admin/games/**` |
| Unit test | `tests/r2-rom.test.ts` (node:test + tsx) |
