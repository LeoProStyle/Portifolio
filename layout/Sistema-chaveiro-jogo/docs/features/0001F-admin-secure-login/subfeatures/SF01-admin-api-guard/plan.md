---
id: 0001F-SF01
type: feature-plan
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [auth, admin, api, middleware]
---

# Plan: 0001F — SF01 admin-api-guard

> **Delivery:** confirm

## TL;DR
Plano do SF01 de 0001F-admin-secure-login. Um guard `requireAdmin()` vira a primeira instrução dos 10 handlers `/api/admin/*` (401 sem sessão, 403 sem role admin), a config do NextAuth é dividida para o middleware ficar edge-safe e redirecionar `/admin`, e as abas do admin trocam um 401/403 por um aviso em português com botão para o login. 17 testes de contrato (7 unitários, 10 E2E).

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Backend](#backend--sf01-admin-api-guard)
- [Frontend](#frontend--sf01-admin-api-guard-rf04)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

Once built: nenhuma chamada a `/api/admin/*` sem sessão de admin altera ou lê o catálogo, mesmo com o middleware contornado.

## Context
{{doc:0001F}} define o epic; este plano cobre só `subfeatures/SF01-admin-api-guard/about.md` (RF01-RF04, RN01-RN03). Ele acrescenta o contrato do guard que SF03 consome (`admin.id`) e deixa a linha do guard isolada no topo de cada handler para SF04 editar o corpo depois.

## Global Constraints
- Node 24.x (AGENTS.md stack; package.json engines)
- `npm run build` exits 0 (AGENTS.md validation_gates.build)
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` exits 0 (AGENTS.md validation_gates.test)
- A verificação no handler é a barreira de segurança; o middleware só redireciona páginas (SF01 about.md RN01)
- O matcher do middleware não cobre `/api/auth/*` nem `/login` (SF01 about.md RN02)
- A verificação de sessão não depende do MongoDB, para continuar funcionando no fallback em memória (SF01 about.md RN03)
- Admin copy in Portuguese (.codeadd/wiki/conventions.md UI language)
- E2E runner `@playwright/test` already in devDependencies; no new dependency in this SF (package.json devDependencies)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| `requireAdmin(request)` como primeira instrução de cada handler | Barreira que resiste ao bypass de middleware | Só middleware — contornável no Next 14.2.15 | about.md RN01; CVE-2025-29927 (patch em 14.2.25) |
| Split `auth.config.ts` (edge-safe) + `auth.ts` (Credentials) | Middleware lê o JWT sem carregar Node/Mongo; SF02 adiciona hash em `auth.ts` sem quebrar o edge | `getToken` manual — salt derivado do nome do cookie, fácil de errar | edge runtime sem `node:crypto`/`mongodb` |
| Guard puro `evaluateAdminSession` + wrapper `requireAdmin` | Testável com node:test sem servidor | Testar só via E2E — sem cobertura do caso 403 | não há usuário não-admin para E2E |
| Sessão expõe `user.id` (copiado de `token.sub`) | SF03 registra o usuário sem chamar `auth()` de novo | SF03 chamar `auth()` | Cross-SF: SF03 consome a identidade |
| UI detecta 401/403 pelo status, num helper `lib/admin-api.ts` | Um lugar só para 7 chamadas; texto do corpo não importa | Checar `data.error` — texto em inglês vazaria | about.md RF04 |
| Botão "Entrar novamente" usa `signOut({callbackUrl})` | Limpa o cookie inválido e evita loop em 403 | `router.push('/login')` — cookie antigo continua | 403 com sessão válida |

## Tasks
Test IDs (T01-T17) refer to the Test Specification below; execution IDs refer to `tasks.md` and are always written `tasks.md Txx`.
- [ ] TASK-1 test: unit tests `tests/auth-guard.test.ts` + `tests/admin-api.test.ts` (red first) — tests T01, T02, T04, T05, T08, T09, T16 exist and fail before the code (tasks.md T01, T02)
- [ ] TASK-2 e2e: author `e2e/admin.qa.spec.ts` + `playwright.config.ts` (tests T03, T06, T07, T10-T15, T17) via qa-pipeline e2e-agent — spec lists the 10 tests (tasks.md T03). E2E environment: (1) `baseURL` = `http://localhost:3001` (`qa.baseUrl` in `.codeadd/settings.json`); `playwright.config.ts` `webServer` runs `npm run dev` with `reuseExistingServer: true`, following the Managed App Lifecycle in `.claude/skills/qa-project/SKILL.md`; (2) admin credentials read from env vars `ADMIN_USERNAME` / `ADMIN_PASSWORD` (`.env.local`), never hard-coded; (3) T17 runs in a separate Playwright project whose `webServer` starts `next dev -p 3002` with `MONGODB_URI` unset, so the in-memory fallback answers; (4) T12 deletes every game it creates, and T03 compares the admin list before and after the anonymous calls
- [ ] TASK-3 tooling (no new dependency: `@playwright/test` and `@axe-core/playwright` are already in `devDependencies`, chromium installed by `/add-qa-setup`): script `test` no `package.json` cobrindo todos os `tests/*.test.ts` — `npm test` roda os 5 arquivos (tasks.md T04)
- [ ] TASK-4 backend: criar `auth.config.ts`, `types/next-auth.d.ts` (Session.user `id`/`role`, JWT `role`) e reduzir `auth.ts` a config + Credentials; sessão copia `token.sub` para `user.id` — `npm run build` passa e login atual continua funcionando (tasks.md T05)
- [ ] TASK-5 backend: criar `lib/auth-guard.ts` (`evaluateAdminSession`, `requireAdmin(request)`) e chamar `requireAdmin(request)` no topo dos 10 handlers admin — tests T01, T02, T03, T04, T05, T11, T12, T13, T16, T17 verdes (tasks.md T06, T07, T08)
- [ ] TASK-6 frontend: criar `lib/admin-api.ts` — tests T08, T09 verdes (tasks.md T09)
- [ ] TASK-7 backend: reescrever `middleware.ts` com wrapper `auth`, matcher `['/admin/:path*']` e redirect para `ADMIN_LOGIN_URL`; o `console.log` por requisição (`middleware.ts:5`) sai junto, porque o arquivo é reescrito e o log passaria a rodar a cada acesso a `/admin` — tests T06, T07, T14, T15 verdes (tasks.md T10)
- [ ] TASK-8 frontend: `onAuthError` em `GamesTab`/`CartridgesTab` (7 fetches) + aviso em `app/admin/page.tsx`; as leituras de `data.error` tocadas nessas 7 chamadas passam a usar o tipo `AdminApiErrorBody` (RF04: o status é checado antes do texto de erro) — test T10 verde (tasks.md T11, T12)

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Matcher pega `/api/auth` ou `/login` e cria loop | M | login impossível | matcher só `/admin/:path*`; T14/T15 |
| `auth.config.ts` importa código Node e quebra o build edge | M | deploy falha | só tipos de `next-auth` no arquivo; `npm run build` como gate |
| Uma das 7 chamadas sem tratamento de 401 | M | "Unauthorized" em inglês na aba | tabela de call sites; T10 por aba |
| Mudança no callback `session` quebra o login atual | L | admin não entra | T07 + teste manual de login antes de seguir |
| Caso 403 sem cobertura E2E | H | regressão silenciosa no 403 | T04 unitário cobre o contrato |
| Middleware e `auth.ts` resolvem segredos diferentes → redirect sem fim para `/login` | L | admin não entra | secret definido só em `auth.config.ts`; T07 |

## Validation
- `npm run build` exit 0
- `npm test` (todos os `tests/*.test.ts`) exit 0, incluindo T01-T02, T04-T05, T08-T09, T16
- `npx playwright test e2e/admin.qa.spec.ts` verde (T03, T06, T07, T10-T15, T17)
- Manual: `curl -i -X POST http://localhost:3001/api/admin/games` sem cookie → 401 com corpo `{"error":"Unauthorized"}`

---

## Test Specification

Scope: SF01 admin-api-guard. Unit = `node --import tsx --test tests/*.test.ts`; E2E = `npx playwright test e2e/` (authored by qa-pipeline e2e-agent, admin creds from `.env.local`). No component runner: UI contract via `lib/admin-api.ts` helper + E2E.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Null session rejected with 401 | backend | RF01 | `evaluateAdminSession(null)` | `ok:false`, 401 `{error:'Unauthorized'}` | status + JSON body |
| T02 | Session without user rejected with 401 | backend | RF01 | `evaluateAdminSession({expires})` (no `user`) | `ok:false`, 401 `{error:'Unauthorized'}` | status + JSON body |
| T03 | All 10 admin routes deny anonymous calls | backend | RF01 | GET/POST/PUT/DELETE on games, games/[id], cartridges, cartridges/[id], no cookie | 401 `{error:'Unauthorized'}`; catalog unchanged | every status 401; follow-up admin GET shows no change |
| T04 | Session lacking admin role gets 403 | backend | RF02 | `evaluateAdminSession({user:{role:'user'}})` and `{user:{}}` | `ok:false`, 403 `{error:'Forbidden'}` | status + JSON body |
| T05 | Admin session passes with identity | backend | RF02 | `evaluateAdminSession({user:{id:'admin',role:'admin',name,email}})` | `ok:true`, `admin.id==='admin'`, name/email echoed | no `response`; identity fields |
| T06 | Anonymous /admin page redirects to login | backend | RF03 | GET `/admin` (and `/admin/x`) no cookie | 307 to `/login?callbackUrl=/admin` | `Location` header / final URL |
| T07 | Logged-in admin reaches /admin, no redirect | backend | RF03 | login admin, GET `/admin` | 200, tabs visible | URL stays `/admin` |
| T08 | Helper maps auth statuses | frontend | RF04 | `getAdminAuthStatus(Response 401 / 403)` | `401` / `403` | strict equality |
| T09 | Helper ignores non-auth statuses | frontend | RF04 | `getAdminAuthStatus(Response 200 / 404 / 500)` | `null` | strict equality; `ADMIN_LOGIN_URL==='/login?callbackUrl=/admin'` |
| T10 | Expired session in tab shows panel | frontend | RF04 | admin on `/admin` Games/Cartridges tab, cookies cleared, then load/save/delete | `role="alert"` "Sua sessão expirou…", tabs gone, no "No games yet." | alert text; click "Entrar novamente" → `/login?callbackUrl=/admin` |
| T11 | Handler rejects even when middleware bypassed | backend | RN01 | POST `/api/admin/games` no cookie + header `x-middleware-subrequest: middleware` | 401 `{error:'Unauthorized'}`, no game created | status; catalog unchanged |
| T12 | Admin API calls keep today's behavior | backend | RN01 | admin session: GET list, POST create, PUT, DELETE game | 200/201/200/200 `{deleted:true}` | statuses + bodies as before |
| T13 | Middleware never answers /api/admin | backend | RN01 | GET `/api/admin/games` no cookie | 401 JSON (not 307 redirect) | status 401, no `Location` |
| T14 | Login and auth endpoints not intercepted | backend | RN02 | GET `/login`, GET `/api/auth/session`, `/api/auth/csrf` no cookie | 200, no redirect loop | status 200; URL unchanged |
| T15 | /admin still covered by matcher | backend | RN02 | GET `/admin` no cookie | redirect (T06) | negative pair of T14 |
| T16 | Guard decides without MongoDB | backend | RN03 | `evaluateAdminSession` with `MONGODB_URI` unset, admin + null sessions | ok / 401 same as T01,T05; no throw/hang | results; test finishes without DB |
| T17 | Guard on in-memory fallback | backend | RN03 | app without Mongo: anonymous vs admin GET `/api/admin/games` | 401 vs 200 | statuses differ by session only |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | tests/auth-guard.test.ts | T01, T02, T04, T05, T16 |
| frontend | tests/admin-api.test.ts | T08, T09 |
| backend+frontend (E2E) | e2e/admin.qa.spec.ts | T03, T06, T07, T10, T11, T12, T13, T14, T15, T17 |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|--------|
| RF01 | T01, T02, T03 | ✅ |
| RF02 | T04, T05 | ✅ |
| RF03 | T06, T07 | ✅ |
| RF04 | T08, T09, T10 | ✅ |
| RN01 | T11, T13 (neg) / T12 (pos) | ✅ |
| RN02 | T14 (pos) / T15 (neg) | ✅ |
| RN03 | T16, T17 (pos) / T01, T17-anon (neg) | ✅ |

---

## Backend — SF01 admin-api-guard

Stack: Next 14.2.15 App Router handlers, NextAuth 5.0.0-beta.31 (JWT, no adapter), no DI/validation lib/tenancy. Error shape `NextResponse.json({ error }, { status })` (`app/api/admin/games/route.ts:77`).

### Endpoints
| Method | Path | Request DTO | Response DTO | Status | Purpose |
|---|---|---|---|---|---|
| GET | /api/admin/games | — | Game[] | 200 / 401 / 403 | list (`games/route.ts:7`) |
| POST | /api/admin/games | game body (unchanged) | {id,...game} | 201 / 401 / 403 / 500 | create (`games/route.ts:18`) |
| GET | /api/admin/games/[id] | — | Game | 200 / 401 / 403 / 404 | read (`games/[id]/route.ts:7`) |
| PUT | /api/admin/games/[id] | game body (unchanged) | {updated:true} | 200 / 401 / 403 / 404 / 500 | update (`games/[id]/route.ts:29`) |
| DELETE | /api/admin/games/[id] | — | {deleted:true} | 200 / 401 / 403 / 404 / 500 | delete (`games/[id]/route.ts:103`) |
| GET | /api/admin/cartridges | — | Cartridge[] | 200 / 401 / 403 / 500 | list (`cartridges/route.ts:5`) |
| POST | /api/admin/cartridges | cartridge body (unchanged) | {id,...cartridge} | 201 / 401 / 403 / 500 | create (`cartridges/route.ts:16`) |
| GET | /api/admin/cartridges/[id] | — | Cartridge | 200 / 401 / 403 / 404 / 500 | read (`cartridges/[id]/route.ts:5`) |
| PUT | /api/admin/cartridges/[id] | cartridge body (unchanged) | {updated:true} | 200 / 401 / 403 / 404 / 500 | update (`cartridges/[id]/route.ts:20`) |
| DELETE | /api/admin/cartridges/[id] | — | {deleted:true} | 200 / 401 / 403 / 404 / 500 | delete (`cartridges/[id]/route.ts:47`) |
Success statuses/bodies unchanged (DELETE stays 200 `{deleted:true}`, not 204 — clients depend on it).

### Guard Contract (`lib/auth-guard.ts`, Node runtime, no Mongo import — RN03)
- `type AdminIdentity = { id: string; name: string | null; email: string | null }`
- `type AdminGuardResult = { ok: true; admin: AdminIdentity; session: Session } | { ok: false; response: NextResponse }`
- `evaluateAdminSession(session: Session | null): AdminGuardResult` — pure, unit-testable: null/no `user` → 401 `{error:'Unauthorized'}`; `user.role !== 'admin'` → 403 `{error:'Forbidden'}`; else ok. Role read from `session.user.role` through the `types/next-auth.d.ts` augmentation (TASK-4).
- `requireAdmin(request: Request): Promise<AdminGuardResult>` — logs rejection reason + `new URL(request.url).pathname`; calls `auth()` from `@/auth` (`auth.ts:5`) then `evaluateAdminSession`. Never throws for auth reasons; an `auth()` failure maps to 401.
- Handler usage (all 10): first statement, before `try`/`request.json()`/`getDb()`: `const guard = await requireAdmin(request)`, return `guard.response` when `!ok`. The two list `GET()` handlers (`games/route.ts:7`, `cartridges/route.ts:5`) gain a `request: Request` parameter; `_request` is renamed `request` where used. [cross-SF review]
- `types/next-auth.d.ts` augments `next-auth` `Session.user` with `id: string; role?: string` and `next-auth/jwt` `JWT` with `role?: string`; guard and callbacks use these types instead of the `auth.ts:47-48` cast. [cross-SF review]
- Identity contract for SF02/SF03: `admin.id` = `token.sub` = the `id` returned by `authorize` (today the literal `'admin'`, `auth.ts:25`). SF02 keeps returning a stable `id`. Until SF02 ships, dev login `admin`/`admin123` (`lib/auth-config.ts:7-8`) and the secret fallback keep working, and middleware and `auth.ts` read the same secret through `authConfig`. [cross-SF review] Kept as an isolated line so SF04 can edit the body below it.
- SF03 consumes `result.admin.id` (and `name`) as "usuário"; no second `auth()` call.
- Identity source: session callback copies `token.sub` (set from authorize's `id:'admin'`, `auth.ts:25`) into `session.user.id`; today only `role` is copied (`auth.ts:45-51`).
- Log rejections via `logAuthEvent` (`lib/auth-config.ts:25`, `[auth]` prefix): reason + path only, no body.

### Middleware (`middleware.ts`)
- Edge-safe config split: new `auth.config.ts` exports `authConfig: NextAuthConfig` with `secret`, `trustHost`, `pages`, `session.strategy:'jwt'`, `jwt`/`session` callbacks and `providers: []` — imports only `next-auth` types, no `node:crypto`, no `mongodb`, no `lib/auth-config`. `auth.ts` spreads `authConfig` and adds `Credentials` (where SF02 adds hashing/throttle — middleware never reaches it).
- `secret` (today `process.env.AUTH_SECRET || 'retrokey-dev-secret'`, `auth.ts:7`), `session.maxAge` and the `jwt`/`session` callbacks are defined only in `auth.config.ts`; `auth.ts` must not override them. SF02 edits `auth.config.ts` for secret fail-closed (RN01) and maxAge (RF05), and edits `auth.ts`/`authorize` only for hashing and throttle. [cross-SF review]
- `middleware.ts` builds `NextAuth(authConfig).auth` and exports it as `middleware` wrapping a callback (`NextAuthResult.auth(NextAuthMiddleware) => NextMiddleware`, verified `node_modules/next-auth/index.d.ts:209-211`). Reads `req.auth` (decoded JWT session); same secret/cookie as `auth.ts`, so no manual `getToken` salt handling (`@auth/core/jwt.js:86` salt = cookie name).
- No `req.auth` → redirect 307 to `new URL(ADMIN_LOGIN_URL, req.nextUrl)` (RF03); `ADMIN_LOGIN_URL` is imported from `lib/admin-api.ts` (edge-safe: no server imports) and is the only place the login URL is written; otherwise pass through. Role is NOT enforced here (RN01; handler is the boundary, Next <14.2.25 CVE-2025-29927).
- `config.matcher: ['/admin/:path*']` (matches `/admin` too) — excludes `/api/*`, `/api/auth/*`, `/login` (RN02). Runtime: edge (default). Remove the per-request `console.log` (`middleware.ts:5`).

### DTOs / Error bodies
| DTO | Fields | Notes |
|---|---|---|
| UnauthorizedError | `{ error: 'Unauthorized' }` | 401, no session/invalid JWT |
| ForbiddenError | `{ error: 'Forbidden' }` | 403, session without `role:'admin'` |
| AdminIdentity | `id, name, email` | guard output, consumed by SF03 |
Frontend (RF04, `GamesTab`/`CartridgesTab`) keys on status 401/403, not on the message text.

### Tests
`tests/auth-guard.test.ts` (node:test + tsx, like `tests/auth-config.test.ts`) covers `evaluateAdminSession`: null → 401, no role → 403, admin → ok + id. Add it to `package.json` test scripts (`package.json:10`).

### Files
{"files":{"create":["auth.config.ts","lib/auth-guard.ts","tests/auth-guard.test.ts","types/next-auth.d.ts","tests/admin-api.test.ts","e2e/admin.qa.spec.ts","playwright.config.ts"],"modify":["auth.ts","middleware.ts","app/api/admin/games/route.ts","app/api/admin/games/[id]/route.ts","app/api/admin/cartridges/route.ts","app/api/admin/cartridges/[id]/route.ts","package.json"]}}

Build note: run GitNexus `impact` (repo `Portifolio`) on each handler and `jwt`/`session` callbacks before editing; `auth` export is unresolved in the graph (grep: only `app/api/auth/[...nextauth]/route.ts:1` imports `@/auth`).

---

## Frontend — SF01 admin-api-guard (RF04)

Stack: Next 14.2.15 client components, raw `fetch` in `useEffect`, no query lib/store, Tailwind zinc/cyan tokens, admin copy in Portuguese. Gate logic in `app/admin/page.tsx:14-21` stays unchanged; only the literal login URL at `:19` is replaced by `ADMIN_LOGIN_URL`. Detection keys on HTTP status 401/403, never on body text (plan-backend). Graph: `impact` on `GamesTab`/`CartridgesTab` = UNKNOWN (no edges); grep confirms the only consumer is `app/admin/page.tsx:75-76`.

### Pages
| Route | Page Component | Purpose |
|---|---|---|
| /admin (modified) | `app/admin/page.tsx` `AdminPage` | Holds `authError` state; when set, renders the expired-session panel in place of tabs (unmounting them stops further calls) |
| /login (unchanged) | `app/login/page.tsx` | Already honors `callbackUrl` (`components/login/LoginForm.tsx:23,48`) |

### Components
{"AdminPage(modified)":{"location":"app/admin/page.tsx","purpose":"owns authError; passes onAuthError to tabs; renders expired panel"},"SessionExpiredNotice(inline in AdminPage, not a new file — single use)":{"location":"app/admin/page.tsx:74-77 block","purpose":"message + 'Entrar novamente' button leading to login"},"GamesTab(modified)":{"location":"components/admin/GamesTab.tsx","purpose":"accepts onAuthError prop; checks every response before other handling"},"CartridgesTab(modified)":{"location":"components/admin/CartridgesTab.tsx","purpose":"same; one onAuthError for both parallel loads"}}
Panel: same card tokens as page (`rounded-2xl border border-zinc-800 bg-zinc-950 p-6`), text `text-zinc-300`, button styled like "Sair" (`app/admin/page.tsx:45`). Copy: 401 "Sua sessão expirou. Entre novamente para continuar."; 403 "Sua conta não tem permissão de administrador. Entre com a conta de admin."; button "Entrar novamente"; `role="alert"` on the message.
Redirect: button calls `signOut({ callbackUrl: ADMIN_LOGIN_URL })` — signOut (not router.push) clears the stale/non-admin JWT cookie so 403 cannot loop and the middleware/client gate send the user back to `/admin` after login. No auto-timer (keeps E2E deterministic).

### Hooks & State
{"hooks":{"none new":"no hooks dir; KISS"},"state":{"AdminPage.authError":"AdminAuthStatus|null (UI state, local useState)","tabs":"unchanged useState; no server cache lib"},"helper":{"lib/admin-api.ts (new, client-safe, no server imports, no Tailwind classes)":"getAdminAuthStatus(response) -> AdminAuthStatus|null; ADMIN_LOGIN_URL constant '/login?callbackUrl=/admin' (also reused by page.tsx:19)"},"props":{"onAuthError":"(status: AdminAuthStatus) => void, required on GamesTab and CartridgesTab"}}

### Types (mirror from backend)
{"AdminAuthStatus":{"fields":"401 | 403","sourceDTO":"guard statuses, plan-backend Guard Contract"},"AdminAuthErrorBody":{"fields":"{ error: 'Unauthorized' } | { error: 'Forbidden' }","sourceDTO":"UnauthorizedError / ForbiddenError"},"AdminApiErrorBody":{"fields":"{ error?: string }","sourceDTO":"NextResponse.json({error}) convention, typed replacement for untyped `data.error` reads"}}
All in `lib/admin-api.ts`; `Game`/`Cartridge` stay in `models/`.

### Call sites to update (7 fetches + 2 empty-state renders)
| File:line | Call | Change |
|---|---|---|
| components/admin/GamesTab.tsx:39-43 | GET /api/admin/games (load) | auth status -> onAuthError, return before setGames |
| components/admin/GamesTab.tsx:86-97 | POST or PUT /api/admin/games[/id] (save) | auth check before `data.error` fallback (no English "Unauthorized" in feedback) |
| components/admin/GamesTab.tsx:109-118 | DELETE /api/admin/games/[id] | same as save |
| components/admin/CartridgesTab.tsx:26 | GET /api/admin/cartridges (Promise.all) | if either response is 401/403 call onAuthError once, skip both setters |
| components/admin/CartridgesTab.tsx:27 | GET /api/admin/games (Promise.all) | covered by row above |
| components/admin/CartridgesTab.tsx:48-68 | POST /api/admin/cartridges | auth check before `data.error` fallback |
| components/admin/CartridgesTab.tsx:80-89 | DELETE /api/admin/cartridges/[id] | same |
| app/admin/page.tsx:75-76 | tab render | pass onAuthError; swap for panel when authError set |
| GamesTab.tsx:211 / CartridgesTab.tsx:160 | empty text on failed load | intersects 401: today a 401 load shows "No games yet."/"No cartridges yet."; fixed for auth by the panel. Other non-ok loads (500) stay out of scope |

Reference: `app/admin/page.tsx:43-48` (signOut + button tokens), `components/admin/GamesTab.tsx:96-98` (error fallback), `.codeadd/wiki/domains/frontend.md:88,228`.

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Contract tests | tasks.md execution |
|----|-------------|----------|--------------|----------------|--------------------|
| RF01 | 401 `{error}` sem sessão em `/api/admin/*` | YES | Backend + Test | T01, T02, T03 | tasks.md T01, T03, T06, T07, T08 |
| RF02 | 403 `{error}` com sessão sem `role: admin` | YES | Backend + Test | T04, T05 | tasks.md T01, T05, T06 |
| RF03 | Middleware redireciona `/admin` sem sessão para `/login?callbackUrl=/admin` | YES | Backend + Test | T06, T07 | tasks.md T03, T05, T10 |
| RF04 | Abas mostram sessão expirada e levam ao login em 401/403 | YES | Frontend + Test | T08, T09, T10 | tasks.md T02, T03, T09, T11, T12 |
| RN01 | Handler é a barreira; middleware só redireciona páginas | YES | Backend + Test | T11, T12, T13 | tasks.md T03, T07, T08, T10 |
| RN02 | Matcher não cobre `/api/auth/*` nem `/login` | YES | Backend + Test | T14, T15 | tasks.md T03, T10 |
| RN03 | Verificação de sessão não depende do MongoDB | YES | Backend + Test | T16, T17 | tasks.md T01, T03, T06 |
| Scope | script `test` cobrindo todos os testes | YES | Tooling | — | tasks.md T04 |

Coverage: 100% (7/7 requirements + scope item).

## Overview
O SF01 fecha a falha mais grave do RetroKey: a API admin aceita chamadas anônimas. Depois dele, toda rota `/api/admin/*` exige sessão com `role: admin`, mesmo que o middleware seja contornado, e o admin que perde a sessão no meio do trabalho vê um aviso em português em vez de erros soltos.

## Main Flow
1. Admin → abre `/admin` sem sessão → middleware redireciona para `/login?callbackUrl=/admin`.
2. Admin → faz login → NextAuth grava JWT com `role: admin` e `sub` → sessão expõe `user.id`.
3. Aba → chama `/api/admin/games` → handler chama `requireAdmin(request)` → `auth()` → `evaluateAdminSession` → ok → lógica atual roda.
4. Chamada anônima (curl ou bypass de middleware) → `requireAdmin(request)` → 401 `{error:'Unauthorized'}` → nada muda no catálogo.
5. Sessão expira → aba recebe 401 → `getAdminAuthStatus` → `onAuthError(401)` → página troca as abas pelo aviso → "Entrar novamente" → `signOut` → `/login?callbackUrl=/admin`.

## Implementation Order
Test (tasks.md T01-T04, red) → Backend (tasks.md T05 split de config → T06 guard → T07/T08 handlers) → Frontend (tasks.md T09 helper) → Backend (tasks.md T10 middleware, importa `ADMIN_LOGIN_URL`) → Frontend (tasks.md T11 abas → T12 página). Não há área de banco neste SF.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Route handler | `app/api/admin/games/route.ts` |
| Error response | `NextResponse.json({ error` |
| Auth config | `auth.ts` (`NextAuth(`, `callbacks`) |
| Auth log | `logAuthEvent` em `lib/auth-config.ts` |
| Client gate | `useSession` em `app/admin/page.tsx` |
| Admin fetch | `fetch('/api/admin` em `components/admin/` |
| Unit test | `tests/auth-config.test.ts` (node:test + tsx) |
