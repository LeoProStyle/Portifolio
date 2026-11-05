# Discovery: 0001F-admin-secure-login

Graph: GitNexus repo `Portifolio` (indexed 2026-11-05; `route_map`, `context`, `impact` used, `query` FTS unavailable on this machine). Docs graph: no work item touches these files. Wiki pages used (all fresh, commit 17bd8acf = HEAD): domains/backend.md, domains/frontend.md, conventions.md, architecture.md.

## Related Features

| ID | Relation | Why |
|---|---|---|
| none | — | `docs/features/` was empty before this feature; `docs/delivered.jsonl` has no entries; docs graph `search`/`touched_by` returned no work item (RELATED_WORK = none) |

## Prerequisites

| Requirement | Status | Evidence |
|---|---|---|
| `auth()` callable from route handlers | Exists, unused by any route; `@/auth` imported only by the nextauth route | `auth.ts:5`, `app/api/auth/[...nextauth]/route.ts:1,3` |
| JWT `role` claim | Stamped and copied to session; nothing enforces it server-side | `auth.ts:40-52` |
| Fail-closed secrets in production | Missing — literal fallbacks in code | `auth.ts:7`, `lib/auth-config.ts:7-8` |
| Shared store for brute-force state | MongoDB is the only shared store | `lib/mongo.ts:33` |
| Password hashing | `node:crypto` (scrypt, `timingSafeEqual`) available on Node runtime; no bcrypt/argon dep | `package.json:18-19` |
| Middleware runtime | Edge runtime: no `fs`, no `mongodb` driver; current middleware inert (`matcher: []`) | `middleware.ts:9-11` |
| Next version | `14.2.15`; below `14.2.25`, the release that patched CVE-2025-29927 (middleware subrequest bypass) — external knowledge, unverified in repo | `package.json:18` |
| NextAuth APIs | `5.0.0-beta.31`; `session.maxAge` and middleware export not used yet — verify in `node_modules` | `package.json:19` |

## Files Mapping

```json
{"modify":["auth.ts","lib/auth-config.ts","middleware.ts","app/api/admin/games/route.ts","app/api/admin/games/[id]/route.ts","app/api/admin/cartridges/route.ts","app/api/admin/cartridges/[id]/route.ts","app/api/rom/[slug]/route.ts","lib/r2.ts","components/login/LoginForm.tsx","components/admin/GamesTab.tsx","components/admin/CartridgesTab.tsx","app/admin/page.tsx","tests/auth-config.test.ts","package.json",".env.example"],"create":["lib/auth-guard.ts","lib/password.ts","lib/login-throttle.ts","lib/rom-path.ts","tests/auth-guard.test.ts","tests/login-throttle.test.ts","tests/rom-path.test.ts","scripts/hash-admin-password.ts"]}
```

| File | Reason |
|---|---|
| `auth.ts` | Timing-safe/hashed authorize, throttle hook, remove `AUTH_SECRET` literal, session lifetime (`auth.ts:5-54`) |
| `lib/auth-config.ts` | Remove production default credentials, gate hint by environment (`:6-23`) |
| `middleware.ts` | Page-level redirect for `/admin` only; not the security boundary (`:9-11`) |
| `app/api/admin/**/route.ts` (4 files) | Server-side admin guard on every handler; stop accepting client `romPath` (games `:18-36`, `[id]:29-67`) |
| `app/api/rom/[slug]/route.ts` | Path containment before `readFileSync` (`:90-125`); route stays public |
| `lib/r2.ts` | Derive `romPath` via `buildRomObjectKey` (`:34-50`) |
| `components/login/LoginForm.tsx` | Stop calling `getAdminLoginHint()` client-side; lockout message (`:13`, `:41-46`) |
| `components/admin/GamesTab.tsx`, `CartridgesTab.tsx` | Handle 401/403/429 responses |
| `tests/auth-config.test.ts` | Asserts literal defaults and hint (`:5-27`); must change with fail-closed rule |
| `package.json` | `test` script covering every `tests/*.test.ts` (`:10`) |
| `.env.example` | Names only; document new vars (`:4,8,10` currently hold concrete values) |
| `lib/auth-guard.ts` (new) | `requireAdmin()` via `auth()` + `role`; no Mongo dependency |
| `lib/password.ts` (new) | scrypt hash/verify with `timingSafeEqual` |
| `lib/login-throttle.ts` (new) | Mongo-backed failed-attempt counter per username+IP with TTL |
| `lib/rom-path.ts` (new) | Pure `romPath` validator: `roms/<slug>.<ext>` or containment in `public/roms` |
| `scripts/hash-admin-password.ts` (new) | CLI producing the password hash value |

## Existing Patterns

- **Auth config:** NextAuth v5 Credentials + JWT, `NextAuth({...})` at `auth.ts:5`, `trustHost: true` at `auth.ts:6`, secret literal fallback at `auth.ts:7`, sign-in page `/login` at `auth.ts:37`.
- **Authorize:** plain `===` compare at `auth.ts:20` (not timing-safe); success returns fixed user `{id:'admin'}` at `auth.ts:24-28`.
- **Credentials:** `resolveAdminCredentials` with `admin`/`admin123` defaults at `lib/auth-config.ts:6-11`; `getAdminLoginHint` literal dev hint at `:17-23`.
- **Auth logging:** `logAuthEvent` → `console.info('[auth] …')` at `lib/auth-config.ts:25-27`; rejection logs `expectedUsername` at `auth.ts:31`.
- **Error shape:** `NextResponse.json({ error }, { status })`, one try/catch per handler (`app/api/admin/games/route.ts:75-77`).
- **Fallback:** admin games handlers use `getAdminGamesStore()` when Mongo fails (`app/api/admin/games/route.ts:41-45`); cartridge routes return 500.
- **Client gate:** `useSession` + `router.replace('/login?callbackUrl=/admin')` at `app/admin/page.tsx:14-21`.
- **Sign-in UI:** `signIn('credentials', {redirect:false})` at `components/login/LoginForm.tsx:28-32`; error copy `Credenciais inválidas.` at `:43`.
- **ROM path:** `romPath` from body, unvalidated (`app/api/admin/games/route.ts:35,54`, `[id]/route.ts:66,93`); read via `path.join(cwd,'public',romPath)` + `readFileSync` at `app/api/rom/[slug]/route.ts:121-125`.
- **Safe key builder:** `buildRomObjectKey` sanitizes slug, file name and extension at `lib/r2.ts:34-50`.

## Reusable Functionality

- `auth` export (`auth.ts:5`) for the server guard.
- `resolveAdminCredentials` / `isUsingDefaultAdminCredentials` (`lib/auth-config.ts:6-15`) as the single credential source.
- `logAuthEvent` (`lib/auth-config.ts:25-27`) for throttle and audit events.
- `getDb` (`lib/mongo.ts:33`) for throttle and audit collections.
- `buildRomObjectKey` (`lib/r2.ts:34-50`) to derive `romPath` server-side.
- `NextResponse` `{error}` convention for 401/403/429.

## Integration Points

- **Admin API:** games GET/POST (`app/api/admin/games/route.ts:7,18`), games `[id]` GET/PUT/DELETE (`:7,29,103`), cartridges GET/POST (`app/api/admin/cartridges/route.ts:5,16`), cartridges `[id]` GET/PUT/DELETE (`:5,20,47`).
- **Admin UI consumers:** `components/admin/GamesTab.tsx` (games routes), `components/admin/CartridgesTab.tsx` (cartridges routes + `/api/admin/games`) — `route_map`.
- **Login UI:** `components/login/LoginForm.tsx`, `app/login/page.tsx`.
- **Public ROM route:** `app/api/rom/[slug]/route.ts:80`, loaded anonymously by the emulator iframe (`components/Emulator.tsx`); a session gate there breaks play.
- **Tests:** `tests/auth-config.test.ts:5-27`; `package.json:10` runs only this file.

## Technology Decisions Pre-decided by the Codebase

- NextAuth v5 Credentials + JWT session, no adapter, no user table (`auth.ts:9`, `:40-52`).
- Single admin identity from env vars (`auth.ts:15-33`).
- Next 14.2 App Router handlers on Node runtime; deploy on Vercel serverless (`vercel.json`) — module-level memory is per instance, so in-memory counters cannot throttle across instances.
- MongoDB is the only shared store; optional, with in-memory fallback for games only.
- No validation library, no extra auth library (`.codeadd/wiki/conventions.md`).
- Console logging with `[auth]` prefix.

## Open Decisions for the Spec

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Where auth is enforced | handler guard / middleware only / both | Both: handler guard is the boundary, middleware only redirects `/admin` pages |
| 2 | Brute-force protection state | Vercel WAF / Mongo TTL collection / in-memory | Mongo TTL collection keyed by username+IP |
| 3 | Password storage | plain env + timing-safe / scrypt hash env / bcrypt dep | scrypt hash via `node:crypto` |
| 4 | Production with missing credentials or secret | fail closed / hide hint only / status quo | Fail closed in production; dev keeps defaults |
| 5 | Session lifetime | 8h / 1 day / library default (~30 days) | 8h |
| 6 | Second factor (TOTP) | now / defer | Defer |
| 7 | Audit trail of admin actions | console only / Mongo collection / both | Console + Mongo audit collection (who, what, when, IP; no bodies) |
| 8 | `romPath` | server-derived only + read-time containment | Both |
| 9 | Public ROM route auth | stay anonymous / signed tokens | Stay anonymous; fix path containment only |
| 10 | Lockout message | generic message + 429 | Generic message, no account enumeration |
| 11 | Throttle when Mongo is down (production) | fail open / fail closed | Spec must choose |

## Risks / Edge Cases

- **Owner lockout:** fail-closed production with env vars unset blocks every login.
- **Dev flow:** gate defaults on `NODE_ENV !== 'production'` so `next dev` with no env still works.
- **Tests:** `tests/auth-config.test.ts` asserts current defaults; rewrite in the same change.
- **Middleware matcher:** a broad matcher catches `/api/auth/*` and `/login` (redirect loops); restrict to `/admin/:path*`.
- **Edge bundle:** middleware importing Node-only code (`node:crypto`, Mongo) fails the edge build.
- **Guard without Mongo:** the guard reads only the JWT, so auth works while Mongo is down.
- **Client handling:** admin tabs do not handle 401 today.
- **Emulator iframe:** must keep anonymous access to `/api/rom/[slug]`.
- **Secrets already exposed:** `.env` and `cookies.txt` are tracked in git and were read during this discovery; credential rotation is required regardless of this feature (user action).
- **Unknown:** NextAuth beta.31 exact `session.maxAge`/middleware API; CVE-2025-29927 applicability to 14.2.15.

## Wiki vs Code Contradictions

1. `.codeadd/wiki/conventions.md:89` says `.env.example` documents names; `.env.example:4,8,10` holds concrete values.
2. `.codeadd/wiki/conventions.md:88` says every env var has a working default; `MONGODB_URI` has none (`lib/mongo.ts:14-16`).
3. Graph index reports `authorize` at `auth.ts:14`; source has it at `auth.ts:15` (off by one).

## Metadata
{"updated":"2026-11-05","feature":"0001F-admin-secure-login","by":"discovery-agent","graph":"Portifolio","wiki_commit":"17bd8acf"}
