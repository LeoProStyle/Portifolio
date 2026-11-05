# Code Quality Review — RetroKey

> Point-in-time report generated 2026-11-05 at commit `17bd8acf` (branch `main`)
> Project: RetroKey (`retrokey` 0.1.0), a single Next.js 14.2 App Router app with next-auth v5 beta, MongoDB and Cloudflare R2
> Method: I read every source file in `app/`, `components/`, `lib/`, `models/`, `scripts/`, `auth.ts`, `middleware.ts` and `tests/`, plus the GitNexus graph (`repo: Portifolio`) for import cycles, fan-in/fan-out and callers. I did not read secret values from `.env*` or the contents of `cookies.txt`.

## Executive Summary

| Area | Status | Score |
|------|--------|-------|
| SOLID | Critical | 4/10 |
| Clean Code | Needs Work | 5/10 |
| Architecture | Critical | 4/10 |
| Technical Debt | High | - |

The codebase is small (about 2,450 lines across 37 source files) and has no circular imports. Its main problems are structural:

1. **No server-side authorization exists.** `middleware.ts` matches nothing, and no route handler calls `auth()`. All `/api/admin/*` endpoints are public.
2. **The data-access layer is missing.** Route handlers call MongoDB directly, and each one picks its own fallback (in-memory store, mock data, or HTTP 500).
3. **Code is duplicated.** R2 client setup, env reading, slug normalization, Game field mapping and seed/mock data are each copied in 2–4 places.

### Size profile (lines per file, top 8)

| File | Lines |
|------|-------|
| `components/admin/GamesTab.tsx` | 303 |
| `components/Emulator.tsx` | 249 |
| `components/admin/CartridgesTab.tsx` | 185 |
| `app/api/rom/[slug]/route.ts` | 151 |
| `lib/r2.ts` | 150 |
| `app/api/admin/games/[id]/route.ts` | 134 |
| `lib/emulator-cores.ts` | 122 |
| `lib/data.ts` | 97 |

## Security-Relevant Quality Findings

These come first because they outrank every other finding by impact.

### S1. Admin API is unauthenticated (Critical)

- `middleware.ts:4-11` only logs the request (`console.log('[middleware] request', ...)`), and `matcher: []` means it runs on no route.
- `auth.ts:5` exports `auth`, `signIn` and `signOut`. A text search shows the only importer of `@/auth` is `app/api/auth/[...nextauth]/route.ts`, which uses only `handlers`. `auth()` is never called on the server.
- `/admin` is guarded only in the client: `app/admin/page.tsx:14-21` uses `useSession` and redirects in a `useEffect`. Anyone can call the APIs directly.
- Unauthenticated callers can therefore reach every `GET/POST/PUT/DELETE` handler under `app/api/admin/games/**` and `app/api/admin/cartridges/**`, including ROM upload (`uploadRomToR2`, which writes to `public/roms` or R2).
- **Fix:** add a `requireAdmin()` helper that calls `auth()` and checks `session.user.role === 'admin'`. Call it at the top of every admin handler, and set `middleware.ts` to `export { auth as middleware }` with `matcher: ['/admin/:path*', '/api/admin/:path*']`.

### S2. Exploit chain: arbitrary local file read through `romPath` (Critical, follows from S1)

- `POST /api/admin/games` stores `body.romPath` with no validation (`app/api/admin/games/route.ts:35,54`).
- `GET /api/rom/[slug]` then runs `path.join(process.cwd(), 'public', normalizedRomPath)` and `fs.readFileSync(localPath)` (`app/api/rom/[slug]/route.ts:121-125`). Nothing checks that the resolved path stays inside `public/`.
- With S1, an anonymous caller can create a game whose `romPath` is a relative path that escapes `public/` (for example, toward `.env`), then download that file through `/api/rom/<slug>`.
- **Fix:** resolve the path and reject it unless it starts with `path.resolve(cwd, 'public', 'roms')`. Accept only `roms/<safe-name>.<allowed-ext>` from `buildRomObjectKey`, and never accept `romPath` from the client.

### S3. Default credentials and a hard-coded secret (High)

- `lib/auth-config.ts:7-8` falls back to `admin` / `admin123` when `ADMIN_USERNAME` and `ADMIN_PASSWORD` are unset.
- `auth.ts:7` falls back to a literal `AUTH_SECRET` (`'retrokey-dev-secret'`). Anyone who reads the repo can forge JWTs on any deployment that forgets to set the variable.
- `components/login/LoginForm.tsx:6,13` calls `getAdminLoginHint()` in a client component. In the browser, `process.env.ADMIN_USERNAME` and `process.env.ADMIN_PASSWORD` are not inlined, so `isUsingDefaultAdminCredentials()` always returns `true`. The login page therefore shows "use admin / admin123" in production too, whatever the server is configured with.
- `tests/auth-config.test.ts` locks this fallback in as intended behavior.
- **Fix:** throw at startup when `NODE_ENV === 'production'` and any of these variables is missing. Compute the hint on the server (`app/login/page.tsx` is already a Server Component) and pass it as a prop.

### S4. Sensitive data in logs (Medium)

- `auth.ts:31` logs `expectedUsername` on every rejected login, which leaks the configured admin username.
- `LoginForm.tsx:25,35,42` logs the attempted username in the browser console.
- `app/api/logs/route.ts` accepts any unauthenticated JSON and writes it to server logs, so anyone can inject log lines or flood the logs.
- **Fix:** drop `expectedUsername`, remove the client-side login logging, and add authentication, a size limit and a schema to `/api/logs` (or delete the route; nothing in the codebase calls it).

### S5. Tracked secret-bearing files (High)

- `git ls-files` lists both `.env` and `cookies.txt`. `.gitignore` ignores only `.env.local`, `.env.*.local` and similar, not `.env` or `cookies.txt`. (Contents not inspected.)
- **Fix:** `git rm --cached .env cookies.txt`, add both to `.gitignore`, and rotate every credential `.env` has ever held: MongoDB URI, R2 keys, `AUTH_SECRET`, admin password.

### S6. Smaller hardening items

- `app/api/rom/[slug]/route.ts:149` returns the raw `error.message` to the client in a 500 response.
- `components/Emulator.tsx:169-182` handles `message` events without checking `event.origin`. Any frame can send `EMULATOR_CANVAS_READY`.
- `app/layout.tsx:5-42` injects an inline script that permanently overwrites `__REACT_DEVTOOLS_GLOBAL_HOOK__` (`configurable: false`). It works around a symptom, and it breaks a strict CSP that disallows inline scripts.

## SOLID Analysis

### Single Responsibility
**Status:** Violated

- `app/api/admin/games/route.ts` POST (lines 18-79) and `app/api/admin/games/[id]/route.ts` PUT (lines 29-101) each do five jobs: parse multipart or JSON, upload the file, build the DTO, choose a persistence backend, and shape the response. → Extract a `parseGameInput(request)` helper and a `gamesRepository`, and keep the handler to roughly 10 lines.
- `app/api/rom/[slug]/route.ts` mixes S3 client construction, env reading, content-type mapping, the R2 vs. filesystem decision, and 15 `console.*` calls. → Move `fetchRomFromR2` into `lib/r2.ts` and the header building into a `romResponse(buffer, filename)` helper.
- `components/admin/GamesTab.tsx` (303 lines) holds data fetching, form state, submission, and the list with inline Test, Copy-link and Delete handlers (lines 222-287). → Split into a `useGames()` hook, `<GameForm>` and `<GameList>`, and move the copy-link and open-tester actions into named functions.
- `components/Emulator.tsx` (249 lines) combines core-fallback state, timers, logging and rendering. → Extract the core retry state machine into a `useEmulatorBoot(coreCandidates)` hook.

### Open/Closed
**Status:** Partially followed

- `lib/emulator-cores.ts:51-122` (`getCoreForSystem`) chains 10 `includes()` checks to map legacy system names. A second, independent alias table lives in `components/Emulator.tsx:16-44` (`getCoreCandidates`). Adding a console means editing both. → Use one table `{ system, aliases[], cores[] }` in `lib/emulator-cores.ts`, and derive both the lookup and the fallback candidates from it.
- The persistence fallback is repeated as `if (db) {...} else {in-memory}` in every games handler. → Put it behind one repository interface with Mongo and in-memory implementations, chosen once.

### Interface Segregation
**Status:** Partially followed

- `models/game.ts` puts `Room` in the same file as `Game`, so `components/RoomsSection.tsx` and `lib/r2.ts` import `@/models/game` to get `Room`. → Move `Room` to `models/room.ts`.
- `app/play/[slug]/page.tsx:8-12` redeclares a local `interface Game` that shadows the model type. → Use `Pick<Game, 'title' | 'console' | 'system'>`.

### Dependency Inversion
**Status:** Violated

- Graph evidence: `getDb` (`lib/mongo.ts`) has **13 direct callers** (`impact`: 19 affected symbols, 13 processes, risk **CRITICAL**). 9 of the 13 are route handlers calling `db.collection<...>(...)` directly. The UI-facing layer depends on the driver, not on an abstraction.
- `lib/data.ts` already acts as a read repository for public pages, but admin routes bypass it and query Mongo themselves. → Add `lib/repositories/games.ts` and `cartridges.ts` (`list`, `findById`, `create`, `update`, `remove`), so routes depend on those and `getDb` has two or three callers instead of 13.

## Clean Code Analysis

### Naming Conventions
**Status:** Inconsistent

- User-facing strings mix Portuguese and English inside the same screens (`GamesTab.tsx`: "Testar", "Link copiado" next to "Edit", "Delete"; `admin/page.tsx`: "Sair" next to "Manage RetroKey"). → Pick one language, or move strings into a small dictionary.
- There is a typo in UI copy: `app/nfc/[id]/page.tsx:40` "Carttridge detected".
- `uploadRomToR2` silently writes to the local disk when R2 is missing or fails (`lib/r2.ts:117-149`), so the name hides a side effect. → Rename it to `storeRom`, or make the fallback explicit.

### Function Size
**Status:** Needs Refactoring

**Large functions (over 50 lines):**

| File | Function | Lines (approx.) | Suggestion |
|------|----------|-------|------------|
| `components/admin/GamesTab.tsx` | `GamesTab` | ~287 | `useGames` hook + `GameForm` + `GameList` |
| `components/Emulator.tsx` | `Emulator` | ~204 | `useEmulatorBoot` hook; renderer stays |
| `components/admin/CartridgesTab.tsx` | `CartridgesTab` | ~178 | `useCartridges` + `CartridgeForm` |
| `app/api/admin/games/[id]/route.ts` | `PUT` | ~73 | shared `parseGameInput` + repository |
| `app/api/rom/[slug]/route.ts` | `GET` | ~72 | `resolveRomSource()` + `romResponse()` |
| `lib/emulator-cores.ts` | `getCoreForSystem` | ~71 | alias table lookup |
| `app/api/admin/games/route.ts` | `POST` | ~62 | shared `parseGameInput` + repository |
| `components/Emulator.tsx` | `tryCore` | ~58 | split the timeout handler from the attempt scheduling |

### Error Handling
**Status:** Needs Work

- **Dead fallback bug** in `lib/data.ts:84-92`: `getRooms()` catches an error from `getRoomsFromStorage()` and then calls `getRoomsFromStorage()` again. The log message says "falling back to mock rooms", but the code retries the same call. The bug is masked today because `readRoomsFromR2` swallows every error and returns `null`. → Return `mockRooms` in the catch, or drop the try/catch.
- Some catch blocks discard the error. The fallbacks hide outages (`app/api/admin/games/route.ts:12-15` and `[id]/route.ts:17-26` serve the in-memory store when Mongo fails, so the admin UI can show stale or fake data with no signal), and the handlers that return 500 do so without logging (`app/api/admin/games/[id]/route.ts:98,131`; `app/api/admin/cartridges/[id]/route.ts:15,42,57`). → Log every caught error, and return 503 rather than mock data on admin paths.
- Fallbacks are inconsistent. Games admin routes fall back to the in-memory store, cartridges admin routes return 500, `getCartridges()` returns mock cartridges when the collection is empty, and `getGames()` always merges mocks into the DB results. The same data looks different depending on the entry point. → Choose one policy, for example mock data only when `MONGODB_URI` is unset.
- `app/api/admin/games/route.ts:59-65` computes `id: \`game-${Date.now()}\`` twice. It assigns `insertedGame`, which is never used in the DB branch, and then responds with Mongo's `_id` (`result.insertedId`) as `id`, while every other endpoint keys on the app-level `id`. → Generate the id once, and return the stored document.
- There is no input validation: `body: any` (`games/route.ts:21`, `games/[id]/route.ts:32`), and the cartridge fields go straight into `$set`. PUT on games writes `undefined` into fields the client left out. → Use a schema validator (zod or a hand-rolled one) for each DTO.

### Code Comments and Logging
**Status:** Excessive logging

- There are no TODO, FIXME or HACK markers. Comments are sparse and mostly helpful.
- The text scan counts **68 lines containing `console.*` calls** across `app/`, `components/`, `lib/`, `auth.ts` and `middleware.ts`. The heaviest are `app/api/rom/[slug]/route.ts` (15), `lib/emulator-cores.ts` (12) and `lib/data.ts` (6). `lib/data.ts:62` logs a sample of game slugs on every lookup. `lib/http-logger.ts` exists but has only 2 call sites (fan-in 1 each, both in `app/api/nfc/validate/route.ts`). → Route all logging through `lib/http-logger.ts` with levels, and make debug output conditional on `NODE_ENV`.

## Architecture

### Layering and Coupling (graph evidence)

| Symbol | Fan-in (CALLS) | Note |
|--------|---------------|------|
| `getDb` (`lib/mongo.ts`) | 13 | Hub; impact risk CRITICAL; called straight from 9 route handlers |
| `getEnvVar` (`lib/r2.ts`) | 6 | Two more private copies: `lib/mongo.ts` (2) and `app/api/rom/[slug]/route.ts` (2) |
| `getR2Endpoint` (`lib/r2.ts`) | 6 | |
| `getAdminGamesStore` (`lib/admin-store.ts`) | 5 | Mutable module-level array used as a database fallback |
| `getRoomBySlug` (`lib/data.ts`) | 4 | |

- **Circular dependencies:** none. A Cypher cycle search over `IMPORTS` edges of length 2–6 returned 0 rows. The import graph (54 file-to-file edges) runs one way: `app` → `components`/`lib` → `models`.
- **God objects:** there is no oversized hub. The coupling problem is spread out: `getDb` fan-in plus duplicated infrastructure.
- **In-memory store:** `lib/admin-store.ts` is module-level mutable state. On Vercel (`vercel.json`) each serverless instance has its own copy, so writes made in the fallback mode are lost or inconsistent between requests.

### Dead or Unused Code (graph + text-search confirmed)

| Symbol | Graph | Text search | Verdict |
|--------|-------|-------------|---------|
| `resetAdminStores` (`lib/admin-store.ts:16`) | `impact` upstream: 0 callers, risk UNKNOWN (tests included) | only its definition | Unused, safe to remove |
| `getAdminCartridgesStore` (`lib/admin-store.ts:12`) | 0 callers, risk UNKNOWN | only its definition | Unused, and cartridge routes never fall back |
| `auth`, `signIn`, `signOut` exports (`auth.ts:5`) | not called | only `handlers` is imported | Unused, which is the root cause of S1 |
| `middleware` (`middleware.ts`) | 0 callers (framework entry point) | `matcher: []` | Never runs |
| `iframeRef`, `attemptRef.iframeElement`, `attemptRef.iframeUrl` (`components/Emulator.tsx:53,62,135`) | n/a | written, never read | Leftover state |
| `POST /api/logs` | framework entry point | no client calls it | Unused endpoint with abuse potential |

The remaining zero-caller functions (`GamesTab`, `CartridgesTab`, `LoginForm`, `RoomsSection`, `Emulator`, the route `GET/POST/PUT/DELETE` handlers, `handleSubmit`, `handleMessage`) are React components, JSX event handlers or Next.js route entry points. They are not dead code.

## Technical Debt

### Code Duplication

| Duplicated logic | Locations | Suggestion |
|------------------|-----------|------------|
| `getEnvVar` | `lib/r2.ts:7`, `lib/mongo.ts:3`, `app/api/rom/[slug]/route.ts:8` | `lib/env.ts` (validated once at startup) |
| `hasR2Config` | `lib/r2.ts:53`, `app/api/rom/[slug]/route.ts:13` | export from `lib/r2.ts` |
| `new S3Client({...})` | `lib/r2.ts:68`, `lib/r2.ts:122`, `app/api/rom/[slug]/route.ts:51` | a single memoized `getR2Client()` |
| Slug normalization regex | `lib/data.ts:7` (`normalizeSlug`), `lib/r2.ts:35-39` | shared `lib/slug.ts` |
| Game field mapping (`console`/`system` cross-fill) | `games/route.ts:47-56`, `games/[id]/route.ts:59-68` and `86-95` | `toGameFields(body)` |
| Seed and mock catalog | `lib/mock-data.ts`, `scripts/seed.ts:5-63`, and a hard-coded `games` array in `app/page.tsx:4-7` | `scripts/seed.ts` imports the fixtures; the home page reads from `getGames()` |
| Core alias tables | `lib/emulator-cores.ts:30-122`, `components/Emulator.tsx:16-44` | one table (see Open/Closed) |
| ROM response headers | `app/api/rom/[slug]/route.ts:102-107`, `128-133` | `romResponse()` helper |

### Tests and Tooling

- `package.json` has one test script (`test:auth`), and it runs only `tests/auth-config.test.ts`. `tests/r2-rom.test.ts` and `tests/rooms-data.test.ts` are not wired to any script. → Add `"test": "node --import tsx --test tests/*.test.ts"`.
- No test covers any route handler, authorization, or ROM path resolution, which is where S1 and S2 live.
- `@playwright/test` and `@axe-core/playwright` are dev dependencies, but there is no `playwright.config.*` and no E2E spec.
- There is no `lint` script and no ESLint config, although `GamesTab.tsx:272` contains an `eslint-disable` comment. → Add `next lint`.
- `next-auth@^5.0.0-beta.31` is a pre-release dependency behind the auth layer. Pin the exact version and watch it for breaking changes.

### Deprecated or Legacy Code

- `lib/emulator-cores.ts:67-115` keeps "Legacy ... system detected" branches for old free-text `system` values. Once stored data is migrated to `EmulatorSystem` values, a one-off migration can replace these branches.
- `models/game.ts:4` keeps both `console?` and `system`, and every write path cross-fills them. → Migrate to `system` only.

## Improvement Opportunities

### High Priority
- [ ] **Enforce server-side admin auth (S1)**: add a `requireAdmin()` guard in every `app/api/admin/**` handler and a real `middleware.ts` matcher | Impact: H | Effort: L
- [ ] **Close the `romPath` traversal (S2)**: confine reads to `public/roms` and stop accepting a free `romPath` from clients | Impact: H | Effort: L
- [ ] **Remove default credentials and the default secret in production (S3)**: fail fast, and render the hint on the server | Impact: H | Effort: L
- [ ] **Untrack `.env` and `cookies.txt`, then rotate credentials (S5)** | Impact: H | Effort: L
- [ ] **Introduce game and cartridge repositories**: cut `getDb` fan-in from 13 to about 2, with one fallback policy | Impact: H | Effort: M

### Medium Priority
- [ ] **Validate request bodies** with a schema for each DTO; remove `any` | Impact: M | Effort: M
- [ ] **Deduplicate the R2 and env helpers** (`getEnvVar` ×3, `hasR2Config` ×2, `S3Client` ×3) | Impact: M | Effort: L
- [ ] **Fix the `getRooms` fallback bug** and the double id generation in games POST | Impact: M | Effort: L
- [ ] **Split `GamesTab`, `CartridgesTab` and `Emulator`** into hooks and subcomponents | Impact: M | Effort: M
- [ ] **Wire all tests into `npm test`** and add handler tests for auth and ROM path | Impact: M | Effort: M

### Low Priority / Nice to Have
- [ ] Unify the emulator core tables into one source.
- [ ] Centralize logging and drop noisy `console.*` calls in production.
- [ ] Remove dead symbols (`resetAdminStores`, `getAdminCartridgesStore`, unused Emulator refs, `/api/logs` if unused).
- [ ] Use one UI language; fix "Carttridge".
- [ ] Replace the React DevTools hook override in `app/layout.tsx` with a fix for the underlying issue.

## Recommendations

### Quick Wins (less than 1 day)
1. Add `requireAdmin()` and call it in all 10 admin handlers; set the `middleware.ts` matcher to `/admin/:path*` and `/api/admin/:path*`.
2. In `app/api/rom/[slug]/route.ts`, resolve the local path and reject anything outside `public/roms`.
3. Make `auth.ts` and `lib/auth-config.ts` throw in production when `AUTH_SECRET`, `ADMIN_USERNAME` or `ADMIN_PASSWORD` is missing; pass the login hint from the server page.
4. `git rm --cached .env cookies.txt`, extend `.gitignore`, and rotate the keys.
5. Fix `lib/data.ts` `getRooms` so it returns `mockRooms` in the catch; remove `expectedUsername` from the auth log.

### Medium-term (1–5 days)
1. Create `lib/env.ts`, `lib/r2-client.ts` and `lib/slug.ts`, and remove the copies.
2. Create `lib/repositories/{games,cartridges}.ts` behind an interface (Mongo plus an in-memory implementation selected once). Migrate all admin handlers and `lib/data.ts`.
3. Add DTO schemas and a shared `parseGameInput(request)` for multipart and JSON input.
4. Add a `test` script that covers all `tests/*.test.ts`, plus handler tests for 401/403 and path traversal.

### Long-term (refactoring)
1. Split the admin tabs and `Emulator` into hooks and presentational components.
2. Use a single data-driven console→core table in `lib/emulator-cores.ts`, and migrate stored `system` values so the legacy branches and the `console` field can go.
3. Decide whether mock and in-memory modes belong in production at all. If not, confine them to local dev and tests.

---
*I generated this review automatically from the source and the GitNexus graph at commit `17bd8acf`. Please validate it manually, especially the exploit chain in S1–S2, before acting on it.*
