---
id: wiki/domains/backend
type: reference
area: backend
description: RetroKey backend — Next.js 14 App Router route handlers, NextAuth v5 credentials login, admin CRUD with Mongo/in-memory fallback, ROM storage on Cloudflare R2 with local fallback, console-based logging. Read before adding or changing any /api route.
sources: [app/api/**/route.ts, auth.ts, middleware.ts, lib/auth-config.ts, lib/http-logger.ts, lib/r2.ts, lib/admin-store.ts, lib/emulator-cores.ts]
commit: 17bd8acf
generated: 2026-11-05
tags: [route-handlers, nextauth, r2, fallback, error-handling, admin-api]
---

# Backend — API Route Handlers

## TL;DR

The backend is Next.js 14.2 App Router route handlers (`app/api/**/route.ts`) in TypeScript, with NextAuth v5 beta (credentials provider, JWT session), the official `mongodb` driver, and `@aws-sdk/client-s3` against Cloudflare R2. There is no service/repository layer, no validation library, no logger library and no DI: each handler reads the body, talks to `getDb()` / `lib/data.ts` / `lib/r2.ts` directly, and returns `NextResponse.json`. The dominant pattern is **graceful degradation**: missing Mongo falls back to an in-memory store, missing R2 falls back to the local `public/` filesystem. Admin API routes are **not protected server-side** (see [Admin Route Protection](#admin-route-protection)).

## TOC

- [Framework & Language](#framework--language)
- [API Surface](#api-surface)
- [Authentication](#authentication)
- [Admin Route Protection](#admin-route-protection)
- [Middleware](#middleware)
- [Validation](#validation)
- [Error Handling & Response Shape](#error-handling--response-shape)
- [Fallback Pattern (Mongo / R2)](#fallback-pattern-mongo--r2)
- [ROM Storage and Delivery](#rom-storage-and-delivery)
- [Logging](#logging)
- [Configuration](#configuration)
- [Reusable Abstractions](#reusable-abstractions)
- [Project Conventions](#project-conventions)
- [Testing](#testing)

## Framework & Language

Route handlers are plain exported `GET`/`POST`/`PUT`/`DELETE` functions, so the HTTP layer and data access live in the same file. Framework: Next.js `14.2.15` App Router | Language: TypeScript `5.6` | Runtime: Node `20.x` (`package.json` `engines`) | Auth: `next-auth@^5.0.0-beta.31` | Data: `mongodb@^7` | Storage: `@aws-sdk/client-s3`. Dev/prod run on port 3001 (`package.json` scripts). Deployed on Vercel (`vercel.json`), which matters for the local-filesystem fallbacks below: writes to `public/` do not persist on a serverless deploy.

Dynamic params use the Next 14 synchronous shape `{ params: { id: string } }` (`app/api/admin/games/[id]/route.ts:7`) — keep that signature; it is not the Next 15 `Promise<params>` form.

## API Surface

Routes split into a public player-facing surface and an admin CRUD surface. Use the code graph (`route_map` on repo `Portifolio`) for current consumers; it does not index `/api/logs`.

| Route | Methods | Purpose | Ref |
|---|---|---|---|
| `/api/nfc/validate` | POST | Resolve an NFC tag id to an active cartridge + game, return `redirectTo: /play/<slug>` | `app/api/nfc/validate/route.ts:5` |
| `/api/game/[id]` | GET | Game by **slug** (param is named `id` but passed to `getGameBySlug`) | `app/api/game/[id]/route.ts:6` |
| `/api/rom/[slug]` | GET | Stream ROM bytes from R2 or `public/` | `app/api/rom/[slug]/route.ts:80` |
| `/api/rooms`, `/api/rooms/[slug]` | GET | Rooms list / single room | `app/api/rooms/route.ts:4`, `app/api/rooms/[slug]/route.ts:4` |
| `/api/logs` | POST | Sink for client-side logs, echoed to server console | `app/api/logs/route.ts:3` |
| `/api/admin/games`, `/api/admin/games/[id]` | GET POST / GET PUT DELETE | Game CRUD, multipart ROM upload | `app/api/admin/games/route.ts:18` |
| `/api/admin/cartridges`, `/api/admin/cartridges/[id]` | GET POST / GET PUT DELETE | Cartridge (NFC tag) CRUD | `app/api/admin/cartridges/route.ts:16` |
| `/api/auth/[...nextauth]` | GET POST | NextAuth handlers re-exported | `app/api/auth/[...nextauth]/route.ts:3` |

Resources are looked up by the app-level string `id` field (`game-<timestamp>`, `cartridge-<timestamp>`), not Mongo `_id` (`app/api/admin/cartridges/[id]/route.ts:8`). There is no `/v1` versioning.

## Authentication

Login is a single hard-coded admin account checked by the NextAuth Credentials provider; there are no user records. `auth.ts` exports `{ handlers, signIn, signOut, auth }`; `authorize` compares against `resolveAdminCredentials()` and the `jwt` callback stamps `token.role = 'admin'`, copied to `session.user.role` (`auth.ts:40-51`). Custom sign-in page is `/login` (`auth.ts:37`).

```ts
// auth.ts:15
async authorize(credentials) {
  const expected = resolveAdminCredentials();
  const isValid = username === expected.username && password === expected.password;
  if (isValid) {
    logAuthEvent('admin login success', { username });
    return { id: 'admin', name: 'Admin', email: 'admin@retrokey.local' };
  }
```

Watch out:
- `lib/auth-config.ts:7-8` falls back to built-in default credentials when `ADMIN_USERNAME`/`ADMIN_PASSWORD` are unset, and `auth.ts:7` falls back to a fixed `AUTH_SECRET`. Both are dev conveniences that become real exposure if the env is missing in production.
- The rejected-login log includes the expected username (`auth.ts:31`).
- `role` is attached via a type cast, not a module augmentation (`auth.ts:48`).

## Admin Route Protection

Current state: nothing on the server checks the session for `/api/admin/*`. `middleware.ts:9-11` exports `matcher: []`, so the middleware runs on no path, and none of the admin handlers call `auth()` (`app/api/admin/games/route.ts:18`, `app/api/admin/cartridges/route.ts:16` go straight to `request.json()` / `getDb()`). The only gate is client-side: `app/admin/page.tsx` uses `useSession()` and redirects to `/login` when unauthenticated — that hides the UI but does not stop a direct HTTP call to the admin API.

Note for graph users: `route_map` attributes `middleware` to every route because the file exists at the root; the empty matcher means it never actually executes. Trust `middleware.ts`, not the attribution.

If you add protection, the idiomatic NextAuth v5 options are a `matcher: ['/api/admin/:path*', '/admin/:path*']` with `export { auth as middleware }`-style session checks, or `const session = await auth()` at the top of each admin handler returning 401. Either is a behavior change for `components/admin/*` fetches — check them.

## Middleware

`middleware.ts` is a placeholder: it logs the pathname and calls `NextResponse.next()` (`middleware.ts:4-7`), and its empty matcher disables it. There is no rate limiting, CORS, or request-id middleware.

## Validation

There is no validation library; handlers read `request.json()` and copy named fields into a typed object, which acts as an allow-list against mass assignment but does no type/shape checking. The one explicit check is `nfcId` presence returning 400 (`app/api/nfc/validate/route.ts:12-15`). Admin POST/PUT accept missing fields and write `undefined` into `$set` (`app/api/admin/cartridges/[id]/route.ts:28-33`).

```ts
// app/api/admin/cartridges/route.ts:21
const newCartridge: Omit<Cartridge, 'id'> = {
  nfcId: body.nfcId,
  gameId: body.gameId,
  collectionNumber: body.collectionNumber,
  status: body.status || 'active'
};
```

When adding fields, extend the explicit field list — never spread `body` into a document. Introducing a schema library would be a project-level decision (no library is in `package.json`).

## Error Handling & Response Shape

Every handler wraps its body in one `try/catch` and maps outcomes to `NextResponse.json` directly; there are no error classes. Conventions in use:

- Error body: `{ error: string }`, sometimes plus `details` (`app/api/rom/[slug]/route.ts:113-116`).
- 400 missing input, 404 not found (`findOne` null, `matchedCount === 0`, `deletedCount === 0`), 500 in the catch.
- Success: raw document/array for reads; `201` + `{ id, ...fields }` for creates; `{ updated: true }` / `{ deleted: true }` for PUT/DELETE (200, not 204); `{ ok: true, ... }` for `/api/nfc/validate` and `/api/logs`.

```ts
// app/api/admin/cartridges/[id]/route.ts:37
if (result.matchedCount === 0) {
  return NextResponse.json({ error: 'Cartridge not found' }, { status: 404 });
}
return NextResponse.json({ updated: true });
```

Watch out: `/api/rom/[slug]` returns the internal error message in `details` on 500 (`app/api/rom/[slug]/route.ts:149`), and `/api/logs` echoes `error.message`. Some admin catches swallow the error without logging (`app/api/admin/cartridges/[id]/route.ts:15-16`).

## Fallback Pattern (Mongo / R2)

The app is built to demo without infrastructure, so game routes treat Mongo as optional. Admin game handlers try `getDb()` in an inner try/catch, set `db = null` on failure, and operate on the module-level array from `lib/admin-store.ts` instead (`app/api/admin/games/[id]/route.ts:48-53, 79-97`). `GET /api/admin/games` returns the in-memory store on any error (`app/api/admin/games/route.ts:12-15`).

```ts
// app/api/admin/games/route.ts:41
try {
  db = await getDb();
} catch (error) {
  db = null;
}
```

Why it matters when editing:
- `lib/admin-store.ts:5-6` holds state per server process, seeded from `lib/mock-data.ts`; it is lost on restart and not shared across serverless instances.
- **Cartridge routes have no fallback** — they return 500 without Mongo (`app/api/admin/cartridges/route.ts:10-13`). Keep this asymmetry in mind before assuming admin works offline.
- Public reads (`getGameBySlug`, `getRooms`, `validateCartridge`) delegate to `lib/data.ts`, which owns its own fallbacks — see [database.md](database.md).
- On the Mongo path, `POST /api/admin/games` computes `Date.now()` twice, so the stored `id` and the returned `insertedGame.id` can differ; the response returns Mongo's `insertedId` instead (`app/api/admin/games/route.ts:59-65`).

## ROM Storage and Delivery

ROMs are uploaded through admin game POST/PUT as multipart field `romFile` (`app/api/admin/games/route.ts:24-32`) and stored by `uploadRomToR2` (`lib/r2.ts:117`). The stored `romPath` encodes where the file lives:

- `roms/<slug>.<ext>` → R2 object key (upload succeeded).
- `/roms/<slug>.<ext>` → file in `public/roms/` (R2 not configured, or upload failed — `lib/r2.ts:118-120, 145-148`).

`GET /api/rom/[slug]` mirrors that rule: after stripping a leading slash, a `roms/` prefix means R2 (`app/api/rom/[slug]/route.ts:96`); otherwise it reads `public/<romPath>` from disk. It only serves `active` games and sets `Content-Disposition: attachment` plus a one-day `Cache-Control`.

```ts
// lib/r2.ts:50
return `roms/${normalizedSlug || 'game'}.${extension}`;
```

Watch out: since the leading slash is stripped before the prefix test, a local `/roms/x.bin` also matches `roms/` and is looked up on R2 first, returning 404 if R2 lacks it. Object keys are derived from the slug only, so re-uploading for the same slug overwrites. Files are buffered fully in memory (no streaming). `lib/r2.ts` also exposes `getRoomsFromStorage()` reading a JSON rooms file from R2 with mock fallback (`lib/r2.ts:100-103`).

## Logging

Logging is plain `console.*` with a bracketed prefix tag per area — `[http]`, `[error]`, `[auth]`, `[api]`, `[rom]`, `[r2]`, `[logs]`, `[emulator cores]`. Two thin helpers exist; most handlers still call `console` directly.

```ts
// lib/http-logger.ts:1
export function logRequest(method: string, url: string, details?: Record<string, unknown>) {
  console.info(`[http] ${method} ${url}`, details ?? {});
}
```

Config: `{"library":"console","format":"text, [tag] prefix","levels":"info/warn/error","context":"ad-hoc objects (slug, nfcId, username)"}`. There is no correlation id. Client logs are forwarded to `POST /api/logs` and printed unvalidated (`app/api/logs/route.ts:5-6`).

## Configuration

Environment is read directly via `process.env` in the module that needs it; there is no central config module. R2 helpers trim values with a local `getEnvVar` (`lib/r2.ts:7-10`) — and `app/api/rom/[slug]/route.ts:8-20` duplicates both `getEnvVar` and `hasR2Config` rather than importing them. Variables read: `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `R2_ENDPOINT` or `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ROOMS_KEY` (Mongo vars belong to `lib/mongo.ts`). Missing config never fails fast — it silently selects a fallback.

## Reusable Abstractions

Reuse these instead of re-implementing:

- `getDb()` at `lib/mongo.ts` — shared Mongo connection (owned by [database.md](database.md)).
- `getGameBySlug`, `getRooms`, `getRoomBySlug`, `validateCartridge` at `lib/data.ts` — read-side queries with fallbacks for public routes.
- `uploadRomToR2`, `buildRomObjectKey`, `getR2Endpoint`, `getR2BucketName`, `getRoomsFromStorage` at `lib/r2.ts` — all R2 access and the `roms/` key convention.
- `getAdminGamesStore` / `getAdminCartridgesStore` / `resetAdminStores` at `lib/admin-store.ts` — in-memory admin fallback (cartridge store exists but no route uses it yet).
- `resolveAdminCredentials`, `isUsingDefaultAdminCredentials`, `getAdminLoginHint`, `logAuthEvent` at `lib/auth-config.ts` — credential resolution and the login-page hint.
- `logRequest`, `logError` at `lib/http-logger.ts` — tagged console logging.
- `getCoreForSystem`, `systemOptions`, `systemToCoreMap` at `lib/emulator-cores.ts` — maps a game's `system` string to an EmulatorJS core, with fuzzy matching for legacy values (`lib/emulator-cores.ts:51-122`). Add new systems to both `EmulatorSystem` and `systemToCoreMap`; the admin form's options come from `systemOptions`.
- `auth()` exported from `auth.ts` — server-side session reader (currently unused by API routes).
- Types: `Game`, `Room` in `models/game.ts`, `Cartridge` in `models/cartridge.ts`.

## Project Conventions

Routes follow the App Router file convention, one `route.ts` per path segment, with the admin surface under `app/api/admin/`. Domain-local conventions:

- New endpoint: create `app/api/<resource>/route.ts` (collection) and `[id]/route.ts` (item); export named method functions returning `NextResponse`.
- Imports use the `@/` alias (`@/lib/...`, `@/models/...`).
- Shared server logic goes in `lib/<kebab-name>.ts` as exported functions — no classes, services or repositories.
- Admin games accept both `multipart/form-data` and JSON (`app/api/admin/games/route.ts:20-36`); keep both branches in sync when adding fields. `console` and `system` are mirrored onto each other for backward compatibility (`app/api/admin/games/route.ts:49-50`).
- Tenancy: none — single-admin app.
- Project-wide rules: [conventions.md](../conventions.md).

## Testing

Tests use Node's built-in runner via `tsx`, colocated under `tests/*.test.ts` and covering only pure `lib` helpers (`tests/auth-config.test.ts`, `tests/r2-rom.test.ts`, `tests/rooms-data.test.ts`). No route handler is tested.

Config: `{"framework":"node:test + tsx","files":"tests/*.test.ts","run":"npm run test:auth (only auth-config wired); node --import tsx --test tests/<file>.test.ts for others"}`

When changing `lib/r2.ts` key rules or `lib/auth-config.ts` fallbacks, run the matching test file; when changing a handler, exercise it manually against both the Mongo-up and Mongo-down paths and `npm run build`.

## Related

- [architecture.md](../architecture.md): overall system shape and where the API sits
- [database.md](database.md): `lib/mongo.ts`, `lib/data.ts`, models and query fallbacks
- [frontend.md](frontend.md): admin tabs, NFC and play pages that call these routes
- [conventions.md](../conventions.md): project-wide naming and stack conventions
