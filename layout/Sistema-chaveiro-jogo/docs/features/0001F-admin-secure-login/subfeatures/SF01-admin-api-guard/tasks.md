# Tasks: 0001F-SF01 admin-api-guard

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 12 |
| Services | test, backend, frontend |

## Requirements Coverage

- [x] RF01 — 401 com `{error}` para qualquer chamada a `/api/admin/*` sem sessão válida
- [x] RF02 — 403 com `{error}` para sessão válida sem `role: admin`
- [x] RF03 — Middleware redireciona página `/admin` sem sessão para `/login?callbackUrl=/admin`
- [x] RF04 — Abas de jogos e cartuchos mostram sessão expirada e levam ao login em 401/403
- [x] RN01 — Verificação no handler é a barreira; middleware só redireciona páginas
- [x] RN02 — Matcher do middleware não cobre `/api/auth/*` nem `/login`
- [x] RN03 — Verificação de sessão não depende do MongoDB

## TDD

- [x] T-TEST-01 Contract test for RF01 (T01 null session 401, T02 session without user 401) — `tests/auth-guard.test.ts`
- [x] T-TEST-02 Contract test for RF02 (T04 non-admin 403, T05 admin ok with identity) — `tests/auth-guard.test.ts`
- [x] T-TEST-03 Contract test for RN03 (T16 guard decides without `MONGODB_URI`) — `tests/auth-guard.test.ts`
- [x] T-TEST-04 Contract test for RF04 (T08 maps 401/403, T09 ignores 200/404/500 and `ADMIN_LOGIN_URL`) — `tests/admin-api.test.ts`
- [x] T-TEST-05 E2E contract for RF01 (T03 all 10 admin routes deny anonymous calls) — `e2e/admin.qa.spec.ts`
- [x] T-TEST-06 E2E contract for RF03 (T06 anonymous `/admin` redirects, T07 admin reaches `/admin`) — `e2e/admin.qa.spec.ts`
- [x] T-TEST-07 E2E contract for RF04 (T10 expired session panel in Games/Cartridges tabs) — `e2e/admin.qa.spec.ts`
- [x] T-TEST-08 E2E contract for RN01 (T11 middleware bypass header still 401, T12 admin behavior unchanged, T13 `/api/admin` answers 401 not 307) — `e2e/admin.qa.spec.ts`
- [x] T-TEST-09 E2E contract for RN02 (T14 `/login` and `/api/auth/*` not intercepted, T15 `/admin` still matched) — `e2e/admin.qa.spec.ts`
- [x] T-TEST-10 E2E contract for RN03 (T17 in-memory fallback: anonymous 401 vs admin 200) — `e2e/admin.qa.spec.ts`

## Execution

- [x] T01 Write guard unit tests T01, T02, T04, T05, T16
  - Service: test
  - Files: `tests/auth-guard.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/auth-guard.test.ts` fails red (module `lib/auth-guard.ts` missing) before T06, green after T06
- [x] T02 Write admin-api helper unit tests T08, T09
  - Service: test
  - Files: `tests/admin-api.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/admin-api.test.ts` fails red (module `lib/admin-api.ts` missing) before T09, green after T09
- [x] T03 Author admin E2E spec covering T03, T06-T07, T10-T15, T17
  - Service: test
  - Files: `e2e/admin.qa.spec.ts`, `playwright.config.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `npx playwright test e2e/admin.qa.spec.ts` against the local dev server (port 3001), admin creds from `.env.local`
- [x] T04 Add npm test script running all tests/*.test.ts
  - Service: test
  - Files: `package.json`
  - Deps: T01, T02
  - Consumes: -
  - Produces: -
  - Verify: `npm test` runs the 5 files `tests/auth-config.test.ts`, `tests/r2-rom.test.ts`, `tests/rooms-data.test.ts`, `tests/auth-guard.test.ts`, `tests/admin-api.test.ts`
- [x] T05 Split edge-safe auth.config.ts; session copies user.id
  - Service: backend
  - Files: `auth.config.ts`, `auth.ts`, `types/next-auth.d.ts`
  - Deps: -
  - Consumes: -
  - Produces: `authConfig: NextAuthConfig`
  - Verify: `npm run build` exits 0 and local login at `http://localhost:3001/login` still reaches `/admin`
- [x] T06 Create pure guard and requireAdmin wrapper
  - Service: backend
  - Files: `lib/auth-guard.ts`
  - Deps: T01, T05
  - Consumes: -
  - Produces: `evaluateAdminSession(session: Session | null): AdminGuardResult`, `requireAdmin(request: Request): Promise<AdminGuardResult>`
  - Verify: `node --import tsx --test tests/auth-guard.test.ts` exits 0 (T01, T02, T04, T05, T16 green)
- [x] T07 Guard first statement in games admin handlers
  - Service: backend
  - Files: `app/api/admin/games/route.ts`, `app/api/admin/games/[id]/route.ts`
  - Deps: T03, T06
  - Consumes: `requireAdmin(request: Request): Promise<AdminGuardResult>` (T06)
  - Produces: -
  - Verify: `curl -i -X POST http://localhost:3001/api/admin/games` without cookie returns 401 `{"error":"Unauthorized"}`
- [x] T08 Guard first statement in cartridges admin handlers
  - Service: backend
  - Files: `app/api/admin/cartridges/route.ts`, `app/api/admin/cartridges/[id]/route.ts`
  - Deps: T03, T06
  - Consumes: `requireAdmin(request: Request): Promise<AdminGuardResult>` (T06)
  - Produces: -
  - Verify: `npx playwright test e2e/admin.qa.spec.ts` (T03, T11, T12, T13, T17 green)
- [x] T09 Create client helper for admin auth statuses
  - Service: frontend
  - Files: `lib/admin-api.ts`
  - Deps: T02
  - Consumes: -
  - Produces: `getAdminAuthStatus(response: Response): AdminAuthStatus | null`, `ADMIN_LOGIN_URL`
  - Verify: `node --import tsx --test tests/admin-api.test.ts` exits 0 (T08, T09 green)
- [x] T10 Middleware redirects anonymous /admin; matcher /admin only
  - Service: backend
  - Files: `middleware.ts`
  - Deps: T03, T05, T09
  - Consumes: `authConfig: NextAuthConfig` (T05), `ADMIN_LOGIN_URL` (T09)
  - Produces: -
  - Verify: `npx playwright test e2e/admin.qa.spec.ts` (T06, T07, T14, T15 green) and `npm run build` exits 0
- [x] T11 Tabs call onAuthError on 401/403 across 7 fetches
  - Service: frontend
  - Files: `components/admin/GamesTab.tsx`, `components/admin/CartridgesTab.tsx`
  - Deps: T09
  - Consumes: `getAdminAuthStatus(response: Response): AdminAuthStatus | null` (T09)
  - Produces: `onAuthError: (status: AdminAuthStatus) => void`
  - Verify: `npm run build` exits 0
- [x] T12 AdminPage renders expired-session panel with signOut button
  - Service: frontend
  - Files: `app/admin/page.tsx`
  - Deps: T03, T09, T11
  - Consumes: `ADMIN_LOGIN_URL` (T09), `onAuthError: (status: AdminAuthStatus) => void` (T11)
  - Produces: -
  - Verify: `npx playwright test e2e/admin.qa.spec.ts` (T10 green: `role="alert"` "Sua sessão expirou…", "Entrar novamente" leads to `/login?callbackUrl=/admin`)



## Acceptance Checklist

- [x] Guard `evaluateAdminSession` returns 401 `{error:'Unauthorized'}` for null session or session without `user` (RF01)
- [x] All 10 handlers in `app/api/admin/games/**` and `app/api/admin/cartridges/**` call `requireAdmin(request)` as first statement (list `GET()` handlers gain a `request: Request` parameter), before `try`/`request.json()`/`getDb()`, and return `guard.response` when `!ok` (RF01, RN01)
- [x] Anonymous GET/POST/PUT/DELETE on every admin route returns 401 and leaves the catalog unchanged (RF01)
- [x] Guard `evaluateAdminSession` returns 403 `{error:'Forbidden'}` when `user.role !== 'admin'` (RF02)
- [x] Admin session yields `ok:true` with `AdminIdentity` `{id, name, email}`; session callback copies `token.sub` to `session.user.id` (RF02)
- [x] `requireAdmin(request)` maps an `auth()` failure to 401 and never throws for auth reasons; rejections logged via `logAuthEvent` with reason + `new URL(request.url).pathname` only (RF01, RF02)
- [x] `auth.config.ts` exports `authConfig: NextAuthConfig` with `providers: []`, importing no `node:crypto`, `mongodb` or `lib/auth-config`; `auth.ts` spreads it and adds Credentials; `secret`, `session.maxAge` and callbacks live only in `auth.config.ts`; `types/next-auth.d.ts` types `Session.user.id`/`role` and `JWT.role` (RF03, RN03)
- [x] `middleware.ts` uses `NextAuth(authConfig).auth`, redirects 307 to `new URL(ADMIN_LOGIN_URL, req.nextUrl)` when `req.auth` is absent, does not enforce role, and drops the per-request `console.log` (RF03, RN01)
- [x] `config.matcher` is exactly `['/admin/:path*']`; `/login`, `/api/auth/session`, `/api/auth/csrf` return 200 without redirect (RN02)
- [x] GET `/api/admin/games` without cookie returns 401 JSON, not a 307 redirect; POST with `x-middleware-subrequest: middleware` still returns 401 (RN01)
- [x] Admin session keeps today's statuses and bodies: GET 200, POST 201, PUT 200, DELETE 200 `{deleted:true}` (RN01)
- [x] `lib/auth-guard.ts` imports no Mongo module; guard tests pass with `MONGODB_URI` unset and the in-memory fallback answers 401 anonymous vs 200 admin (RN03)
- [x] `lib/admin-api.ts` exports `getAdminAuthStatus` (401/403 → status, else `null`), `ADMIN_LOGIN_URL === '/login?callbackUrl=/admin'` and types `AdminAuthStatus`, `AdminAuthErrorBody`, `AdminApiErrorBody`, with no server imports (RF04)
- [x] `GamesTab` and `CartridgesTab` take a required `onAuthError` prop and check auth status on all 7 fetches before any `data.error` fallback; `CartridgesTab` parallel load calls it once and skips both setters (RF04)
- [x] `AdminPage` holds `authError`, replaces the tabs with a `role="alert"` panel ("Sua sessão expirou. Entre novamente para continuar." for 401; "Sua conta não tem permissão de administrador. Entre com a conta de admin." for 403) and an "Entrar novamente" button calling `signOut({ callbackUrl: ADMIN_LOGIN_URL })` (RF04)
- [x] `package.json` `test` script runs every `tests/*.test.ts`, including `tests/auth-guard.test.ts` and `tests/admin-api.test.ts` (RF01, RF02, RF04, RN03)

## Validation Gates

- [x] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
