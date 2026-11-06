---
id: 0001F-SF02
type: feature-plan
created: 2026-11-06
updated: 2026-11-06
related: [0001F]
tags: [auth, login, password, throttle, session]
---

# Plan: 0001F — SF02 login-hardening

> **Delivery:** confirm

## TL;DR
Plano do SF02 de 0001F-admin-secure-login. A senha do admin passa a ser um hash scrypt em `ADMIN_PASSWORD_HASH`, comparado com `timingSafeEqual`. Um contador atômico no MongoDB bloqueia o par usuário+IP por 15 minutos após 5 falhas, e o callback de credenciais responde 429 com `Retry-After`. Em produção o login recusa tudo quando falta credencial, `AUTH_SECRET` ou MongoDB. A sessão termina 8 horas após o login, e a dica `admin/admin123` só aparece em desenvolvimento com os valores padrão. 24 testes de contrato (22 unitários, 2 E2E; IDs T01-T23 e T25, T24 não usado). A regressão do login do admin é o E2E T07 do SF01.

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Backend](#backend--sf02-login-hardening)
- [Frontend](#frontend--sf02-login-hardening)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

Once built: em produção nenhum login entra com senha padrão, sem segredo ou sem MongoDB, e a 6ª tentativa errada em 15 minutos recebe 429.

## Context
{{doc:0001F}} define o epic; este plano cobre só `subfeatures/SF02-login-hardening/about.md` (RF01-RF07, RN01-RN05, RNF01). Ele se apoia no SF01 (done): `auth.config.ts` edge-safe guarda `secret`, `session` e callbacks; `auth.ts` guarda só o provider Credentials; `admin.id` = `token.sub` = `'admin'`. SF03 consome `getClientIp` e os resultados de login `success`, `failure` e `locked` deste SF (`LoginOutcome`; `disabled` não é auditado).

## Global Constraints
- Node 24.x (AGENTS.md stack; package.json engines)
- `npm run build` exits 0 (AGENTS.md validation_gates.build)
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` exits 0 (AGENTS.md validation_gates.test)
- `auth.config.ts` não importa `node:crypto`, `mongodb` nem `lib/auth-config` — o middleware roda no edge (auth.config.ts header comment, SF01)
- `secret`, `session` e callbacks ficam só em `auth.config.ts`; `auth.ts` não os sobrescreve (SF01 plan.md Middleware)
- Sem dependência nova: scrypt e `timingSafeEqual` vêm de `node:crypto` (about.md Decisions)
- Nenhum log de autenticação contém a senha, o hash ou o usuário esperado (about.md RN05)
- Texto da tela em português (.codeadd/wiki/conventions.md UI language)
- `.env.example` só com nomes de variáveis (about.md Scope)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Formato do hash `scrypt:16384:8:1:<salt b64url>:<hash b64url>` (salt 16 bytes, chave 64 bytes) | Parâmetros dentro do valor permitem trocar o custo depois; `:` e base64url não têm `$`, que o carregador de `.env` do Next expande como variável | `$`-separado (estilo PHC) — vira texto vazio no `.env.local` | RF01; `@next/env` usa dotenv-expand |
| Lógica de login em `lib/admin-login.ts` com dependências injetadas (env, store, relógio) | `authorize` e a pré-checagem ficam testáveis com node:test, sem servidor nem Mongo | Testar só por E2E — o Mongo não responde nesta máquina | about.md Success Metrics |
| Contador conta tentativas, não falhas: incremento atômico antes de conferir a senha; sucesso apaga o registro | Uma rajada paralela não passa de 5 tentativas; com o sucesso zerando, o efeito é igual a contar falhas | Ler, decidir e gravar em passos separados — rajada passa do limite | RF03, RN04 |
| 429 sai de um wrapper do `POST` em `app/api/auth/[...nextauth]/route.ts`, só para `/callback/credentials` | `authorize` só devolve usuário ou null; o wrapper lê uma cópia do corpo e responde antes do NextAuth | Mudar o NextAuth; responder 429 de dentro do `authorize` (impossível) | about.md Observation sobre 429 |
| Corpo do 429 inclui `url` com `error=CredentialsSignin` | `signIn()` do `next-auth/react` faz `new URL(data.url)`; sem `url` lança TypeError e a tela mostra "Erro inesperado" | Corpo só `{error}` | RF04 (mesma mensagem) |
| Sessão de 8h absoluta: `session.maxAge = 28800` + claim `loginAt` checado no callback `jwt` | O NextAuth renova o `exp` a cada leitura de sessão (`@auth/core/lib/actions/session.js:33`); só `maxAge` deixaria a sessão deslizar além de 8h | Só `maxAge` | RF05 ("8 horas após o login") |
| `secret` só cai em `'retrokey-dev-secret'` fora de produção | Em produção sem `AUTH_SECRET` o NextAuth recusa (MissingSecret) e o guard do SF01 responde 401 | Manter o literal em produção — JWT forjável | RN01 |
| Dica calculada no servidor (`app/login/page.tsx`) e passada ao `LoginForm` como prop | No browser as env vars não existem, então hoje a dica aparece sempre | Ler env no client | about.md Problem |
| Chamadas ao store com limite de 5 s (`THROTTLE_TIMEOUT_MS`) | O driver espera até 30 s para achar o servidor; login não pode travar quando o Mongo cai | Mudar `serverSelectionTimeoutMS` global (afeta 13 fluxos) | RN03 |

## Tasks
Test IDs (T01-T23, T25) refer to the Test Specification below; execution IDs refer to `tasks.md` and are always written `tasks.md Txx`.
- [ ] TASK-1 test: unit tests red first — `tests/password.test.ts`, `tests/auth-config.test.ts` (rewritten), `tests/request-ip.test.ts`, `tests/login-throttle.test.ts`, `tests/admin-login.test.ts`, `tests/admin-session.test.ts`, `tests/hash-script.test.ts` (tasks.md T01-T05)
- [ ] TASK-2 e2e: `e2e/login.qa.spec.ts` (T22, T23) via qa-pipeline e2e-agent; same `playwright.config.ts` projects as SF01; T23 uses a random username `e2e-sf02-<timestamp>` so the real admin key is never locked; when MongoDB does not answer, T23 is skipped with an annotation locally and fails in CI (tasks.md T06)
- [ ] TASK-3 backend: `lib/password.ts` — T01-T04 green (tasks.md T07)
- [ ] TASK-4 backend: rewrite `lib/auth-config.ts` (production rules, dev order, hint `string | null`) — T05-T08 green (tasks.md T08)
- [ ] TASK-5 backend: `lib/request-ip.ts` and `lib/login-throttle.ts` (policy, memory store, Mongo store with TTL index) — T09-T14 green (tasks.md T09, T10)
- [ ] TASK-6 backend: `lib/mongo.ts` clears the cached connection promise when it rejects ⚠ GitNexus `impact` on `getMongoClient` = CRITICAL (13 flows, every Mongo route) — change limited to the rejection path (tasks.md T11)
- [ ] TASK-7 backend: `lib/admin-login.ts` (`authorizeAdmin`, `checkCredentialsLock`), `auth.ts` calls it, nextauth route wraps `POST` — T15-T20 green (tasks.md T12, T13)
- [ ] TASK-8 backend: `auth.config.ts` + `lib/admin-session.ts` + `types/next-auth.d.ts` (secret, 8h, `loginAt`) — T21 green (tasks.md T14)
- [ ] TASK-9 tooling: `scripts/hash-admin-password.ts`, `package.json` script `hash-password`, `.env.example` — T25 green (tasks.md T15)
- [ ] TASK-10 frontend: `app/login/page.tsx` passes the hint; `LoginForm` drops the `lib/auth-config` import and shows one message for wrong password and 429 — T22, T23 green (tasks.md T16)

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Deploy sem `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `AUTH_SECRET` na Vercel bloqueia todo login | H | dono fica fora do admin | aviso no relatório final; `.env.example` lista as três; log `[auth] login disabled` com o motivo |
| `lib/mongo.ts` é usado por 13 fluxos (impact CRITICAL) | M | rotas públicas e admin param | muda só o caminho de rejeição; `npm test` + E2E SF01 `e2e/admin.qa.spec.ts` (T07 login, T12 CRUD admin) como regressão |
| Mongo fora do ar: login leva até 10 s antes de recusar (2 × `THROTTLE_TIMEOUT_MS`: pré-checagem + `authorize`) | M | espera na tela | aceito; produção recusa de qualquer forma, dev segue sem bloqueio |
| Mongo inacessível nesta máquina | H | T23 não roda local | lógica coberta por T10-T17 com store em memória; T23 obrigatório antes do merge com Mongo acessível |
| IP falso via `x-forwarded-for` fora da Vercel | M | atacante troca de chave a cada tentativa | a Vercel sobrescreve o cabeçalho; limite documentado; scrypt + senha forte seguram ataque distribuído |
| Ataque distribuído por muitos IPs contra o mesmo usuário | M | contador por par não segura | escopo do about.md (par usuário+IP); hash scrypt torna cada tentativa cara só offline — registrado como limite conhecido |
| `@next/env` expande `$` no `.env.local` | M | hash corrompido em dev | formato sem `$` (T01) |
| Callback `jwt` devolvendo null quebra o middleware | L | redirect sem fim | null só depois de 8h ou sem `loginAt`; T21 cobre só o callback; o caminho do middleware é coberto pelo E2E SF01 T07 no caso não expirado e pela checagem manual de expiração em Validation |
| `next build` com `NODE_ENV=production` sem `AUTH_SECRET` local | M | build local falha ao pré-renderizar | nada no build chama `auth()`; build é gate em toda tarefa |

## Validation
- `npm run build` exit 0
- `npm test` exit 0 (T01-T21, T25 e os testes do SF01)
- `npx playwright test e2e/login.qa.spec.ts --project=main` verde (T22; T23 com Mongo acessível)
- `npx playwright test e2e/admin.qa.spec.ts --project=main` continua verde (regressão SF01)
- Manual: `npm run hash-password`, colar o valor em `.env.local` como `ADMIN_PASSWORD_HASH`, login com a senha nova entra; com a antiga, não
- Manual: editar a constante `ADMIN_SESSION_MAX_AGE_SECONDS` em `lib/admin-session.ts` para um valor baixo (sem commit), entrar, esperar passar o limite e abrir `/admin` → um redirect para `/login`; o cookie de sessão é apagado pelo NextAuth quando o callback `jwt` devolve null (`@auth/core/lib/actions/session.js:54-55`), sem código próprio
- Manual (MongoDB acessível): 10 POSTs paralelos a `/api/auth/callback/credentials` com usuário `e2e-sf02-<ts>` → o documento em `login_attempts` termina com `attempts` ≥ 6 e `lockedUntil` não nulo, e no máximo 5 chegam à comparação de senha (log `failure`)

---

## Test Specification

Scope: SF02 login-hardening. Unit = `node --import tsx --test tests/*.test.ts` (`npm test`); E2E = `npx playwright test e2e/login.qa.spec.ts`. Dependencies (env, store, clock, console) injected; no test touches a real MongoDB.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Hash has documented format, unique salt | backend | RF01 | `hashPassword('s3nh@')` twice | `scrypt:16384:8:1:<salt>:<hash>`, no `$`, values differ | regex + inequality |
| T02 | Verify hash accepts right, rejects wrong | backend | RF01, RNF01 | right; wrong first char; wrong last char; longer | true / false / false / false | strict equality |
| T03 | Malformed hash never throws | backend | RF01 | `''`, `'plain'`, `'scrypt:x'`, bad base64 | false | resolves false |
| T04 | Plain compare is length-safe | backend | RN02, RNF01 | equal, different, different length | true / false / false | no throw |
| T05 | Production uses hash, ignores plain | backend | RF06 | prod env: user+hash+secret; prod env: user+`ADMIN_PASSWORD`+secret | ok kind `hash`; `ok:false` reason `missing-credentials` | result fields |
| T06 | Production missing var refuses | backend | RN01 | prod env missing each of `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`; prod env with malformed hash | `ok:false`, reason `missing-credentials` / `missing-credentials` / `missing-auth-secret` / `missing-credentials` | reason |
| T07 | Dev order hash > plain > default | backend | RN02 | dev env: hash+plain; plain only; none | kind `hash`; `plain`; `plain` `admin`/`admin123` with `usingDefaults:true` | fields |
| T08 | Hint only for dev defaults | backend | RN02 | dev none; dev configured; prod | `'Modo desenvolvimento: use admin / admin123'`; null; null | strict equality |
| T09 | Client IP from first forwarded value | backend | RF07 | `x-forwarded-for: ' 1.2.3.4 , 10.0.0.1'`; absent; empty | `'1.2.3.4'`; `'unknown'`; `'unknown'` | strict equality |
| T10 | 6th attempt after 5 failures locked | backend | RF03 | 5 attempts at t0..t0+4m, 6th at t0+5m | 6th `allowed:false`, `retryAfterSeconds` = 900 − 60 | decision |
| T11 | Success clears counter | backend | RF03 | 4 attempts, clear, 4 attempts | 9th call still `allowed:true` | decision |
| T12 | Fixed window starts at first attempt | backend | RF03 | 4 at t0, 5th at t0+15m+1s, 6th right after | both allowed (new window) | decision |
| T13 | Lock ends after 15 minutes | backend | RF03 | locked at t5; attempt at t5+15m+1s | `allowed:true`, counter restarted at 1 | decision |
| T14 | Key isolates user and IP | backend | RF03, RF07 | lock `u|1.1.1.1`; try `u|2.2.2.2` and `v|1.1.1.1` | both allowed | decision |
| T15 | Valid hashed login returns admin user | backend | RF01 | prod deps, right password | `{id:'admin',name:'Admin',email:'admin@retrokey.local'}`, store cleared | value + store |
| T16 | Production without config refuses and logs | backend | RN01 | prod env missing secret | null; one `console.error` `[auth] login disabled` `{reason}`; store untouched | spy |
| T17 | Store failure: prod refuses, dev skips | backend | RN03 | store throws / exceeds timeout | prod null; dev right password → user | value |
| T18 | Logs carry no secret data | backend | RN05 | wrong, right, locked, disabled logins | captured logs contain no password, hash, expected username | substring scan |
| T19 | Locked callback answers 429 | backend | RF03, RF04 | POST `/api/auth/callback/credentials` form body, locked key | 429, `Retry-After` integer seconds, JSON `{error:'TooManyRequests', url}` with `error=CredentialsSignin`; one `locked` log with `{username, ip}`, no password or hash | status, header, body, log spy |
| T20 | Pre-check passes other requests | backend | RF03 | unlocked key; POST `/api/auth/signout`; store error | null (handler runs) | null |
| T21 | Session ends 8h after login | backend | RF05 | `authConfig.session.maxAge`; jwt callback at sign-in, at +7h59m, at +8h01m; `isAdminSessionExpired(undefined, now)` | 28800; `loginAt` stamped; token kept; null; true | values |
| T22 | Login page hides hint with configured creds | frontend | RN02, RF04 | dev server with `.env.local` creds; wrong password | no "admin123" text; "Credenciais inválidas." | page text |
| T23 | 6th wrong login gets 429, same message | frontend | RF03, RF04 | 6 wrong logins, username `e2e-sf02-<ts>` | 6th callback response 429 + `Retry-After`; same "Credenciais inválidas." | network + text |
| T25 | Hash script prints one verifiable value | backend | RF02 | `tsx scripts/hash-admin-password.ts` with password on stdin | one stdout line, T01 format, `verifyPasswordHash` true; password not in output | spawn + verify |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | tests/password.test.ts | T01, T02, T03, T04 |
| backend | tests/auth-config.test.ts (rewritten) | T05, T06, T07, T08 |
| backend | tests/request-ip.test.ts | T09 |
| backend | tests/login-throttle.test.ts | T10, T11, T12, T13, T14 |
| backend | tests/admin-login.test.ts | T15, T16, T17, T18, T19, T20 |
| backend | tests/admin-session.test.ts | T21 |
| backend | tests/hash-script.test.ts | T25 |
| frontend (E2E) | e2e/login.qa.spec.ts | T22, T23 |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|--------|
| RF01 | T01, T02, T03, T15 | ✅ |
| RF02 | T25 | ✅ |
| RF03 | T10-T14, T19, T20, T23 | ✅ |
| RF04 | T19 (body), T22, T23 | ✅ |
| RF05 | T21 | ✅ |
| RF06 | T05 | ✅ |
| RF07 | T09, T14 | ✅ |
| RN01 | T06, T16 | ✅ |
| RN02 | T04, T07, T08, T22 | ✅ |
| RN03 | T17 | ✅ |
| RN04 | T10-T14 (store contract), Mongo store review | ✅ |
| RN05 | T18 | ✅ |
| RNF01 | T02, T04 (equal-length `timingSafeEqual`) + code review | ✅ |

---

## Backend — SF02 login-hardening

Stack: Next 14.2.15 route handlers (Node runtime), NextAuth 5.0.0-beta.31 Credentials + JWT, MongoDB driver v7, no validation lib. Graph: `resolveAdminCredentials` ← `authorize` only (LOW); `getAdminLoginHint` ← `LoginForm` only (LOW); `getMongoClient` CRITICAL (13 flows).

### Endpoints
| Method | Path | Request DTO | Response DTO | Status | Purpose |
|---|---|---|---|---|---|
| POST | /api/auth/callback/credentials | form `username`, `password`, `csrfToken`, `callbackUrl` (NextAuth) | NextAuth redirect JSON; on lock `LockedResponse` | 200 / 429 | login; 429 + `Retry-After` when the user+IP key is locked |
| other | /api/auth/* | unchanged | unchanged | unchanged | wrapper passes through |

### DTOs / Types
| DTO | Fields | Notes |
|---|---|---|
| LockedResponse | `{ error: 'TooManyRequests', url: string }` | `url` = `<origin>/api/auth/error?error=CredentialsSignin`; header `Retry-After: <seconds>` |
| AdminCredentialsResult | `{ ok: true; username: string; secret: { kind: 'hash' \| 'plain'; value: string }; usingDefaults: boolean } \| { ok: false; reason: 'missing-credentials' \| 'missing-auth-secret' }` | `lib/auth-config.ts`; edge-unsafe callers only |
| ThrottleDecision | `{ allowed: true } \| { allowed: false; retryAfterSeconds: number }` | `lib/login-throttle.ts` |
| AttemptRecord | `{ _id: string; attempts: number; windowStart: Date; lockedUntil: Date \| null; expiresAt: Date }` | collection `login_attempts`, TTL index `{ expiresAt: 1 }`, `expireAfterSeconds: 0` |
| LoginOutcome | `'success' \| 'failure' \| 'locked' \| 'disabled'` | logged now; SF03 RF01 audits `success`, `failure`, `locked` (each with attempted username + IP); `disabled` is a configuration-refusal log with no username or IP, not audited [cross-SF review] |
| AdminLoginDeps | `{ env, getStore, now, timeoutMs }` | defaults: `process.env`, Mongo store, `() => new Date()`, exported `THROTTLE_TIMEOUT_MS` (5000) — one source for the timeout |

### Modules
- `lib/password.ts` (Node only): `hashPassword(password: string): Promise<string>`; `verifyPasswordHash(password: string, encoded: string): Promise<boolean>` (parses params, derives with the stored salt, `timingSafeEqual` on equal-length buffers, false on any parse error); `verifyPlainPassword(input: string, expected: string): boolean` (SHA-256 of both, `timingSafeEqual`).
- `lib/auth-config.ts` (no Node imports; no longer imported by any client file): `resolveAdminCredentials(env?: NodeJS.ProcessEnv): AdminCredentialsResult`; `getAdminLoginHint(env?: NodeJS.ProcessEnv): string | null`; `isProductionEnv(env?: NodeJS.ProcessEnv): boolean`; `logAuthEvent` unchanged; `isUsingDefaultAdminCredentials` removed (only caller is `getAdminLoginHint`). Production: requires `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`; ignores `ADMIN_PASSWORD`; a hash that does not match the `scrypt:N:r:p:salt:hash` shape (string check, no crypto) also yields `ok:false` reason `missing-credentials`, so a bad paste logs `login disabled` instead of looking like wrong passwords. [readback] Dev: `ADMIN_USERNAME || 'admin'`; hash, else plain, else `admin123`.
- `lib/request-ip.ts`: `getClientIp(headers: Headers): string` — first comma-separated `x-forwarded-for` value, trimmed, else `'unknown'`. SF03 imports it.
- `lib/login-throttle.ts`: constants `MAX_ATTEMPTS = 5`, `WINDOW_SECONDS = 900`, `LOCK_SECONDS = 900`; `throttleKey(username: string, ip: string): string` (`<username trimmed, max 256 chars>|<ip>`); interface `LoginAttemptStore { increment(key: string, now: Date): Promise<AttemptRecord>; get(key: string): Promise<AttemptRecord | null>; clear(key: string): Promise<void> }`; `peekLoginLock(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>`; `registerLoginAttempt(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>`; `clearLoginAttempts(store: LoginAttemptStore, key: string): Promise<void>`; `createMemoryAttemptStore(): LoginAttemptStore`; `getMongoAttemptStore(): Promise<LoginAttemptStore>`.
  - `increment` semantics (both stores, one document write): Mongo = a single `findOneAndUpdate` with an aggregation-pipeline update (`returnDocument: 'after'`, `upsert: true`) that (a) resets `attempts`/`windowStart`/`lockedUntil` when `lockedUntil <= now`, or when `lockedUntil` is null and `windowStart + 900 s <= now`; (b) sets `attempts = attempts + 1`; (c) sets `lockedUntil = now + 900 s` when the new `attempts` is 5, keeps the existing value when above 5; (d) sets `expiresAt = max(windowStart + 900 s, lockedUntil)`. Retry once on duplicate key (E11000). The memory store applies the same four steps synchronously.
  - Decision: `attempts > 5` → denied, `retryAfterSeconds = ceil((lockedUntil − now)/1000)`; `attempts > 5` with `lockedUntil` null is impossible by construction — if seen, treat as locked for `LOCK_SECONDS`.
  - `peekLoginLock` reads `get(key)` and returns `allowed:false` only when `lockedUntil > now`.
  - `getMongoAttemptStore` creates the TTL index once per instance (`createIndex` is idempotent).
- `lib/mongo.ts`: when `client.connect()` rejects, reset `clientPromise` and `client` to null before rethrowing, so the next call retries. Nothing else changes.
- `lib/admin-login.ts`: `authorizeAdmin(credentials: Partial<Record<string, unknown>>, request: Request, deps?: AdminLoginDeps): Promise<AdminUser | null>` and `checkCredentialsLock(request: Request, deps?: AdminLoginDeps): Promise<Response | null>`; `AdminUser = { id: 'admin'; name: 'Admin'; email: 'admin@retrokey.local' }` (same `id` SF01/SF03 rely on).
  - `authorizeAdmin` order: (1) `resolveAdminCredentials` not ok → `console.error('[auth] login disabled', {reason})`, return null (RN01); (2) username/password must be strings; (3) `registerLoginAttempt` with the timeout — store error: production → log `throttle-unavailable`, null (RN03); dev → log once, continue without throttle; denied → log `locked`, null; (4) compare username with `verifyPlainPassword` and password with `verifyPasswordHash` or `verifyPlainPassword` — both always run; (5) success → `clearLoginAttempts`, log `success` `{username, ip}`, return `AdminUser`; failure → log `failure` `{username, ip}` (attempted name only — RN05), null.
  - `checkCredentialsLock`: only `POST` whose path ends with `/callback/credentials`; reads `request.clone().formData()` field `username` (the name `LoginForm` sends; missing → pass through); `peekLoginLock` with the timeout; locked → log outcome `locked` `{username, ip}` (attempted name from the form body, `getClientIp(request.headers)`; same `[auth]` shape as `failure`, RN05), then 429 `LockedResponse` + `Retry-After`; any error or not locked → null. This is the single emission point for `locked` in the normal flow; the `authorizeAdmin` `locked` branch only covers a lock that lands between the pre-check and `registerLoginAttempt`.
  - `auth.config.ts` may import only edge-safe modules with no imports of their own (`lib/admin-session.ts`); never `node:crypto`, `mongodb` or `lib/auth-config`. [cross-SF review]
- `auth.ts`: `authorize(credentials, request)` returns `authorizeAdmin(credentials, request)`. Stops importing `resolveAdminCredentials`.
- `app/api/auth/[...nextauth]/route.ts`: `GET = handlers.GET`; `POST(request: NextRequest)` returns `checkCredentialsLock(request)` when non-null, else `handlers.POST(request)`.
- `lib/admin-session.ts` (edge-safe, no imports): `ADMIN_SESSION_MAX_AGE_SECONDS = 28800`; `isAdminSessionExpired(loginAt: number | undefined, nowSeconds: number): boolean` (missing `loginAt` = expired).
- `auth.config.ts`: `secret: process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'retrokey-dev-secret')`; `session: { strategy: 'jwt', maxAge: ADMIN_SESSION_MAX_AGE_SECONDS }`; `jwt` callback: on `user` set `role` and `loginAt = now seconds`; otherwise return null when `isAdminSessionExpired(token.loginAt, now)`. Header comment updated (maxAge now set).
- `types/next-auth.d.ts`: `JWT` gains `loginAt?: number`.

### Tooling
- `scripts/hash-admin-password.ts`: reads the password from stdin (hidden prompt on a TTY, raw pipe otherwise), never from argv; refuses empty input; prints only the hash line. `package.json`: `"hash-password": "tsx scripts/hash-admin-password.ts"`.
- `.env.example`: adds `ADMIN_PASSWORD_HASH=` with comment `npm run hash-password`; marks `ADMIN_PASSWORD` as dev-only, ignored in production.

### Files
{"files":{"create":["lib/password.ts","lib/request-ip.ts","lib/login-throttle.ts","lib/admin-login.ts","lib/admin-session.ts","scripts/hash-admin-password.ts","tests/password.test.ts","tests/request-ip.test.ts","tests/login-throttle.test.ts","tests/admin-login.test.ts","tests/admin-session.test.ts","tests/hash-script.test.ts","e2e/login.qa.spec.ts"],"modify":["lib/auth-config.ts","lib/mongo.ts","auth.ts","auth.config.ts","types/next-auth.d.ts","app/api/auth/[...nextauth]/route.ts","tests/auth-config.test.ts","package.json",".env.example"]}}

---

## Frontend — SF02 login-hardening

Stack: Next 14.2.15; `app/login/page.tsx` is a server component; `LoginForm` is a client component calling `signIn('credentials', {redirect:false})`. No new screen or component (UX design step skipped).

### Pages
| Route | Page Component | Purpose |
|---|---|---|
| /login (modified) | `app/login/page.tsx` | Calls `getAdminLoginHint()` on the server; passes `hint` to `LoginForm` |

### Components
{"LoginForm(modified)":{"location":"components/login/LoginForm.tsx","purpose":"prop hint: string | null; no lib/auth-config import; renders the hint line only when hint is non-null; any result.error or result.status === 429 shows 'Credenciais inválidas.'"}}

### Types
{"LoginFormProps":{"fields":"hint: string | null","sourceDTO":"getAdminLoginHint return"}}

Reference: `components/login/LoginForm.tsx:13,41-46,74`, `app/login/page.tsx:13-15`.

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Contract tests | tasks.md execution |
|----|-------------|----------|--------------|----------------|--------------------|
| RF01 | Hash scrypt em `ADMIN_PASSWORD_HASH`, `timingSafeEqual` | YES | Backend | T01-T03, T15 | tasks.md T01, T07, T12, T13 |
| RF02 | Script gera o hash | YES | Tooling | T25 | tasks.md T05, T15 |
| RF03 | Bloqueio 15 min após 5 falhas, 429 + `Retry-After` | YES | Backend + E2E | T10-T14, T19, T20, T23 | tasks.md T03, T04, T06, T10, T12, T13 |
| RF04 | Mesma mensagem para senha errada e bloqueio | YES | Frontend + Backend | T19, T22, T23 | tasks.md T04, T06, T12, T16 |
| RF05 | Sessão expira 8h após o login | YES | Backend | T21 | tasks.md T04, T14 |
| RF06 | Produção exige 3 vars; `ADMIN_PASSWORD` ignorada | YES | Backend | T05 | tasks.md T02, T08 |
| RF07 | IP = primeiro valor de `x-forwarded-for` ou `unknown` | YES | Backend | T09, T14 | tasks.md T03, T09 |
| RN01 | Produção sem config ou segredo recusa e loga | YES | Backend | T06, T16 | tasks.md T02, T04, T08, T12, T14 |
| RN02 | Dev: ordem hash > plain > padrão; dica só no padrão | YES | Backend + Frontend | T04, T07, T08, T22 | tasks.md T02, T08, T16 |
| RN03 | Produção sem Mongo recusa; dev sem bloqueio | YES | Backend | T17 | tasks.md T04, T11, T12 |
| RN04 | Contador no MongoDB com expiração | YES | Backend | T10-T14 | tasks.md T03, T10 |
| RN05 | Logs sem senha, hash ou usuário esperado | YES | Backend | T18 | tasks.md T04, T12 |
| RNF01 | Tempo não depende da posição do erro | YES | Backend | T02, T04 + review | tasks.md T01, T07 |
| Scope | `tests/auth-config.test.ts` reescrito | YES | Test | T05-T08 | tasks.md T02 |
| Scope | script `test` cobre `tests/*.test.ts` | YES (delivered by SF01) | Tooling | — | SF01 tasks.md T04 |
| Scope | `.env.example` só com nomes | YES | Tooling | — | tasks.md T15 |

Coverage: 100% (13/13 requirements + 3 scope items).

## Overview
O SF02 fecha a porta de entrada do admin. Hoje o login aceita tentativas sem fim, cai em `admin/admin123` quando faltam variáveis, compara a senha com `===` e mostra a senha padrão na tela até em produção. Depois dele, a senha só existe como hash scrypt, o par usuário+IP é bloqueado após 5 tentativas erradas, e produção sem configuração completa recusa todo login.

## Main Flow
1. Admin → envia o formulário → `signIn` faz POST `/api/auth/callback/credentials`.
2. Route wrapper → `checkCredentialsLock` → par usuário+IP bloqueado → log `locked` `{username, ip}` → 429 + `Retry-After` → tela mostra "Credenciais inválidas.".
3. Não bloqueado → `handlers.POST` → `authorize` → `authorizeAdmin`: config ok → `registerLoginAttempt` (atômico) → compara usuário e senha em tempo constante.
4. Sucesso → `clearLoginAttempts` → JWT com `role`, `sub='admin'`, `loginAt` → `/admin`.
5. Falha → contador sobe; a 5ª falha grava `lockedUntil`; a 6ª tentativa recebe 429 no passo 2.
6. A cada leitura de sessão → callback `jwt` → passou de 8h desde `loginAt` → null → cookie apagado → guard do SF01 responde 401 e a aba mostra "Sua sessão expirou".

## Implementation Order
Test (tasks.md T01-T06, red) → Backend puro (tasks.md T07 password → T08 auth-config → T09 request-ip → T10 throttle) → Backend infra (tasks.md T11 mongo) → Backend login (tasks.md T12 admin-login → T13 auth.ts + route) → Backend sessão (tasks.md T14) → Tooling (tasks.md T15) → Frontend (tasks.md T16). Não há área de banco separada: a coleção `login_attempts` é criada pelo store (TTL index), sem migration.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Auth config edge-safe | `auth.config.ts` (`callbacks`, `secret`) |
| Credentials provider | `auth.ts` (`authorize`) |
| Auth log | `logAuthEvent` em `lib/auth-config.ts` |
| Mongo access | `getDb` em `lib/mongo.ts` |
| Injected dependency test | `requireAdmin(request, readSession)` em `lib/auth-guard.ts` |
| Unit test | `tests/auth-guard.test.ts` (node:test + tsx, console capture) |
| E2E | `e2e/admin.qa.spec.ts`, `playwright.config.ts` |
