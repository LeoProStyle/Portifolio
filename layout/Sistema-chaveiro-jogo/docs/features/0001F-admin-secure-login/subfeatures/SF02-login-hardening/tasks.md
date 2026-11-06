# Tasks: 0001F-SF02 login-hardening

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 16 |
| Services | test, backend, frontend |

## Requirements Coverage

- [x] RF01 — Senha do admin como hash scrypt em `ADMIN_PASSWORD_HASH`, comparada com `timingSafeEqual`
- [x] RF02 — Script do projeto gera o valor de `ADMIN_PASSWORD_HASH`
- [x] RF03 — Bloqueio de 15 min por par usuário+IP após 5 falhas em 15 min, 429 com `Retry-After`
- [x] RF04 — Mesma mensagem na tela para senha errada e bloqueio
- [x] RF05 — Sessão do admin expira 8 horas após o login
- [x] RF06 — Produção exige `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`; `ADMIN_PASSWORD` ignorada
- [x] RF07 — IP = primeiro valor de `x-forwarded-for`, ou `unknown`
- [x] RN01 — Produção sem credenciais ou sem `AUTH_SECRET` recusa todo login e loga erro
- [x] RN02 — Dev: hash > plain > `admin`/`admin123`; dica só com o padrão
- [x] RN03 — Produção sem MongoDB recusa login; dev sem MongoDB não bloqueia
- [x] RN04 — Contador de falhas no MongoDB com expiração
- [x] RN05 — Logs de autenticação sem senha, hash ou usuário esperado
- [x] RNF01 — Tempo de resposta não varia com a posição do caractere errado

## TDD

- [x] T-TEST-01 Contract test for RF01/RNF01 (T01 format, T02 verify, T03 malformed, T04 plain compare) — `tests/password.test.ts`
- [x] T-TEST-02 Contract test for RF06/RN01/RN02 (T05-T08) — `tests/auth-config.test.ts`
- [x] T-TEST-03 Contract test for RF07 (T09) — `tests/request-ip.test.ts`
- [x] T-TEST-04 Contract test for RF03/RN04 (T10-T14) — `tests/login-throttle.test.ts`
- [x] T-TEST-05 Contract test for RF01/RF03/RF04/RN01/RN03/RN05 (T15-T20) — `tests/admin-login.test.ts`
- [x] T-TEST-06 Contract test for RF05 (T21) — `tests/admin-session.test.ts`
- [x] T-TEST-07 Contract test for RF02 (T25) — `tests/hash-script.test.ts`
- [ ] T-TEST-08 E2E contract for RN02/RF04 (T22) and RF03/RF04 (T23) — `e2e/login.qa.spec.ts`

## Execution

- [x] T01 Write password unit tests T01-T04
  - Service: test
  - Files: `tests/password.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/password.test.ts` fails red (module `lib/password.ts` missing) before T07, green after T07
- [x] T02 Rewrite auth-config unit tests T05-T08
  - Service: test
  - Files: `tests/auth-config.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/auth-config.test.ts` fails red before T08, green after T08
- [x] T03 Write request-ip and throttle unit tests T09-T14
  - Service: test
  - Files: `tests/request-ip.test.ts`, `tests/login-throttle.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/request-ip.test.ts tests/login-throttle.test.ts` fails red before T09/T10, green after
- [x] T04 Write admin-login and admin-session unit tests T15-T21
  - Service: test
  - Files: `tests/admin-login.test.ts`, `tests/admin-session.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/admin-login.test.ts tests/admin-session.test.ts` fails red before T12/T14, green after
- [x] T05 Write hash script test T25
  - Service: test
  - Files: `tests/hash-script.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/hash-script.test.ts` fails red before T15, green after
- [x] T06 Author login E2E spec T22, T23
  - Service: test
  - Files: `e2e/login.qa.spec.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `npx playwright test e2e/login.qa.spec.ts --project=main` — T22 green after T16; T23 green after T13 and T16 with MongoDB reachable (skipped with annotation locally when it is not, fails in CI)
- [x] T07 Create scrypt hash and timing-safe compare
  - Service: backend
  - Files: `lib/password.ts`
  - Deps: T01
  - Consumes: -
  - Produces: `hashPassword(password: string): Promise<string>`, `verifyPasswordHash(password: string, encoded: string): Promise<boolean>`, `verifyPlainPassword(input: string, expected: string): boolean`
  - Verify: `node --import tsx --test tests/password.test.ts` exits 0
- [x] T08 Rewrite credential resolution with production rules
  - Service: backend
  - Files: `lib/auth-config.ts`
  - Deps: T02
  - Consumes: -
  - Produces: `resolveAdminCredentials(env?: NodeJS.ProcessEnv): AdminCredentialsResult`, `getAdminLoginHint(env?: NodeJS.ProcessEnv): string | null`, `isProductionEnv(env?: NodeJS.ProcessEnv): boolean`
  - Verify: `node --import tsx --test tests/auth-config.test.ts` exits 0
- [x] T09 Create client IP reader
  - Service: backend
  - Files: `lib/request-ip.ts`
  - Deps: T03
  - Consumes: -
  - Produces: `getClientIp(headers: Headers): string`
  - Verify: `node --import tsx --test tests/request-ip.test.ts` exits 0
- [x] T10 Create login throttle policy and stores
  - Service: backend
  - Files: `lib/login-throttle.ts`
  - Deps: T03
  - Consumes: -
  - Produces: `throttleKey(username: string, ip: string): string`, `peekLoginLock(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>`, `registerLoginAttempt(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>`, `clearLoginAttempts(store: LoginAttemptStore, key: string): Promise<void>`, `getMongoAttemptStore(): Promise<LoginAttemptStore>`
  - Verify: `node --import tsx --test tests/login-throttle.test.ts` exits 0
- [x] T11 Retry Mongo connection after a rejected connect
  - Service: backend
  - Files: `lib/mongo.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: run GitNexus `impact` on `getMongoClient` first (CRITICAL, 13 flows) and report it; `npm test` exits 0 and `npm run build` exits 0
- [x] T12 Create admin login orchestration and lock pre-check
  - Service: backend
  - Files: `lib/admin-login.ts`
  - Deps: T04, T07, T08, T09, T10, T11
  - Consumes: `verifyPasswordHash(password: string, encoded: string): Promise<boolean>` (T07), `verifyPlainPassword(input: string, expected: string): boolean` (T07), `resolveAdminCredentials(env?: NodeJS.ProcessEnv): AdminCredentialsResult` (T08), `isProductionEnv(env?: NodeJS.ProcessEnv): boolean` (T08), `getClientIp(headers: Headers): string` (T09), `throttleKey(username: string, ip: string): string` (T10), `peekLoginLock(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>` (T10), `registerLoginAttempt(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision>` (T10), `clearLoginAttempts(store: LoginAttemptStore, key: string): Promise<void>` (T10), `getMongoAttemptStore(): Promise<LoginAttemptStore>` (T10)
  - Produces: `authorizeAdmin(credentials: Partial<Record<string, unknown>>, request: Request, deps?: AdminLoginDeps): Promise<AdminUser | null>`, `checkCredentialsLock(request: Request, deps?: AdminLoginDeps): Promise<Response | null>`
  - Verify: `node --import tsx --test tests/admin-login.test.ts` exits 0 (T15-T20)
- [x] T13 Wire authorize and credentials callback wrapper
  - Service: backend
  - Files: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`
  - Deps: T06, T12
  - Consumes: `authorizeAdmin(credentials: Partial<Record<string, unknown>>, request: Request, deps?: AdminLoginDeps): Promise<AdminUser | null>` (T12), `checkCredentialsLock(request: Request, deps?: AdminLoginDeps): Promise<Response | null>` (T12)
  - Produces: -
  - Verify: `npm run build` exits 0; login at `http://localhost:3001/login` with `.env.local` credentials reaches `/admin`; `npx playwright test e2e/admin.qa.spec.ts --project=main` still green
- [x] T14 Absolute 8h session and production-only secret fallback
  - Service: backend
  - Files: `lib/admin-session.ts`, `auth.config.ts`, `types/next-auth.d.ts`
  - Deps: T04
  - Consumes: -
  - Produces: `ADMIN_SESSION_MAX_AGE_SECONDS`, `isAdminSessionExpired(loginAt: number | undefined, nowSeconds: number): boolean`
  - Verify: `node --import tsx --test tests/admin-session.test.ts` exits 0 and `npm run build` exits 0 (middleware edge bundle)
- [x] T15 Hash generator script, npm script and env example
  - Service: backend
  - Files: `scripts/hash-admin-password.ts`, `package.json`, `.env.example`
  - Deps: T05, T07
  - Consumes: `hashPassword(password: string): Promise<string>` (T07)
  - Produces: -
  - Verify: `node --import tsx --test tests/hash-script.test.ts` exits 0; `.env.example` holds names only
- [x] T16 Server-computed hint and generic login error
  - Service: frontend
  - Files: `app/login/page.tsx`, `components/login/LoginForm.tsx`
  - Deps: T06, T08
  - Consumes: `getAdminLoginHint(env?: NodeJS.ProcessEnv): string | null` (T08)
  - Produces: -
  - Verify: `npx playwright test e2e/login.qa.spec.ts --project=main` (T22 green; T23 green with MongoDB reachable) and `npm run build` exits 0

## Acceptance Checklist

- [x] `hashPassword` returns `scrypt:16384:8:1:<salt b64url>:<hash b64url>` with a random 16-byte salt and no `$` (RF01)
- [x] `verifyPasswordHash` and `verifyPlainPassword` compare only with `timingSafeEqual` on equal-length buffers and return false on malformed input without throwing (RF01, RNF01)
- [x] `scripts/hash-admin-password.ts` reads the password from stdin, never argv, and prints one hash line that `verifyPasswordHash` accepts; `npm run hash-password` runs it (RF02)
- [x] 5 attempts for one user+IP key inside 15 min from the first lock the key for 15 min from the 5th; the next callback POST answers 429 with integer `Retry-After` and body `{error:'TooManyRequests', url}` with `error=CredentialsSignin`, after logging one `locked` outcome with `{username, ip}` only (RF03, RN05)
- [x] The attempt counter increments atomically before the password check and a successful login clears it (RF03, RN04)
- [x] `LoginForm` shows "Credenciais inválidas." both for a wrong password and for a 429 (RF04)
- [x] `authConfig.session.maxAge === 28800`; the `jwt` callback stamps `loginAt` at sign-in and returns null once 8h have passed (RF05)
- [x] In production `resolveAdminCredentials` requires `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `AUTH_SECRET` and ignores `ADMIN_PASSWORD`; a malformed `ADMIN_PASSWORD_HASH` counts as missing (RF06, RN01)
- [x] `getClientIp` returns the trimmed first `x-forwarded-for` value or `'unknown'`, and the throttle key uses it (RF07)
- [x] In production a missing credential or `AUTH_SECRET` refuses every login and logs `[auth] login disabled` with the reason; `auth.config.ts` uses `'retrokey-dev-secret'` only outside production (RN01)
- [x] Outside production the order is hash, then plain, then `admin`/`admin123`; `/login` shows the dev hint only when the defaults are in use, computed on the server (RN02)
- [x] In production a store error or a store call over 5 s refuses the login; outside production it skips the throttle (RN03)
- [x] `login_attempts` documents carry `expiresAt` under a TTL index (`expireAfterSeconds: 0`) (RN04)
- [x] No `[auth]` log line carries the password, the hash or the expected username; `expectedUsername` is gone from `auth.ts` (RN05)
- [x] `lib/mongo.ts` resets its cached promise only when `connect()` rejects; GitNexus impact (CRITICAL) reported before the edit (RN03)
- [x] `auth.config.ts` still imports no `node:crypto`, `mongodb` or `lib/auth-config`; `npm run build` exits 0 (RF05, RN01)

## Known Issues

- T-TEST-08: e2e/login.qa.spec.ts T23 (real 429 after 5 wrong logins) skipped locally - MongoDB unreachable; run it, and tests/login-throttle-mongo.test.ts, with MongoDB reachable before merge. RF04 429 half is proven by T19 (server body) + T29 (browser message, intercepted 429).

## Validation Gates

- [x] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
