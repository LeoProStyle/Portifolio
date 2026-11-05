---
id: wiki/conventions
type: reference
area: conventions
description: Project-wide RetroKey rules — Stack Conventions table (no tenancy, no DI, no barrels, raw mongodb driver, TS type entities, no validation library), naming, slug and ID formats, error-response and log-prefix conventions, env-var access, UI language. Read before writing any route, lib helper or model.
sources: [app/**, lib/**, models/**, components/**, scripts/seed.ts, "*.{ts,json}", .env.example, .gitignore]
commit: 17bd8acf
generated: 2026-11-05
tags: [stack-conventions, naming, error-handling, ids, slugs, logging]
---

# Conventions

## TL;DR

The canonical home for rules that apply across every area of RetroKey; domain pages link here instead of restating. Every Stack Conventions row below is `detected` from code — there are no `decided` rows yet (a `decided` row would be intent, not evidence). Headline rules: entities are plain TypeScript `type` aliases, data access is the raw `mongodb` driver with no repository layer, there is no validation library, and every route handler wraps its body in `try/catch` and answers `NextResponse.json({ error }, { status })`.

## TOC

- [Stack Conventions](#stack-conventions)
- [Naming](#naming)
- [IDs and Slugs](#ids-and-slugs)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Configuration and Env Vars](#configuration-and-env-vars)
- [Code Style](#code-style)
- [Commit and Branch Conventions](#commit-and-branch-conventions)
- [Related](#related)

## Stack Conventions

| Convention | Value | Where / enforcement | Evidence | Source |
|---|---|---|---|---|
| Tenancy | no | single-tenant; no tenant/account key on `Game`, `Cartridge` or `Room` | none | detected |
| DI | none | module-level functions and module singletons (`clientPromise`, in-memory stores) imported directly | `lib/mongo.ts:8-9` | detected |
| Barrels | no | no re-export-only `index.ts` files; import modules by path via `@/` alias | none | detected |
| Layering | `app/**` → `components/**` → `lib/*` → `models/*`, inward only; admin route handlers skip `lib/data.ts` and call `lib/mongo.ts` directly | see [architecture.md](architecture.md#layer-hierarchy) | `tsconfig.json:17-19` | detected |
| Validation | none | ad-hoc presence checks inside route handlers; request bodies are typed `any` | `app/api/nfc/validate/route.ts:12-15`, `app/api/admin/games/route.ts:21` | detected |
| ORM / data access | raw `mongodb` driver (v7) | no repository pattern; `lib/data.ts` is the read model, admin routes query collections inline | `lib/mongo.ts:1`, `lib/data.ts:20` | detected |
| Entity language | TypeScript | `export type` aliases (no classes, no schema lib) in `models/` | `models/game.ts:1`, `models/cartridge.ts:1` | detected |

## Naming

File and symbol naming follows Next.js and React defaults, with a few project-specific patterns.

- **Routes:** Next.js App Router conventions — `page.tsx`, `route.ts`, dynamic segments in brackets (`[slug]`, `[id]`, `[...nextauth]`).
- **Components:** PascalCase file per default-exported component (`components/Emulator.tsx`, `components/admin/GamesTab.tsx`); area subfolders are lowercase (`components/admin/`, `components/login/`).
- **lib modules:** kebab-case filenames (`lib/admin-store.ts`, `lib/emulator-cores.ts`, `lib/http-logger.ts`), named function exports, camelCase verbs (`getGames`, `getGameBySlug`, `validateCartridge`, `uploadRomToR2`).
- **Models:** singular lowercase file, PascalCase type (`models/game.ts` → `Game`, `Room`; `models/cartridge.ts` → `Cartridge`).
- **Tests:** `tests/<subject>.test.ts` (`tests/r2-rom.test.ts`); E2E specs go in `e2e/<surface>.qa.spec.ts` (see `.claude/skills/qa-project/SKILL.md`).
- **Mongo collections:** lowercase plural matching the entity — `games`, `cartridges` (`lib/data.ts:20`, `lib/data.ts:43`).
- **Domain words:** `system` is the emulator-relevant platform and drives the core; `console` is a legacy display alias kept in sync with it on writes (`app/api/admin/games/route.ts:49-50`). Prefer `system` in new code.

## IDs and Slugs

Entities carry an app-level string `id`, distinct from Mongo's `_id`; lookups always filter on `id`, never `_id`.

- **Format:** `<entity>-<n>` in seed/mock data (`scripts/seed.ts:7`, `lib/mock-data.ts:6`), `<entity>-${Date.now()}` on create (`app/api/admin/games/route.ts:61`, `app/api/admin/cartridges/route.ts:30`).
- **Lookups:** `findOne({ id })` / `updateOne({ id })` (`app/api/admin/cartridges/[id]/route.ts:8`, `app/api/admin/cartridges/[id]/route.ts:25-26`).
- **Watch out:** create handlers respond with `id: result.insertedId` (the Mongo `ObjectId`) rather than the stored string `id` (`app/api/admin/games/route.ts:65`, `app/api/admin/cartridges/route.ts:33`). A client that uses the returned id for a later PUT/DELETE will miss. Return the stored `id` in new code.
- **Slugs:** normalized as lowercase, non-alphanumerics → `-`, trimmed dashes (`lib/data.ts:7-13`); the same rule is duplicated for R2 keys (`lib/r2.ts:35-39`). Game lookup by slug falls back to matching the normalized title (`lib/data.ts:57-60`).
- **ROM object keys:** `roms/<normalized-slug>.<ext>` (`lib/r2.ts:50`); a `romPath` beginning with `roms/` means "R2 key", anything else is a path under `public/` (`app/api/rom/[slug]/route.ts:96`, `app/api/rom/[slug]/route.ts:121`).
- **Cartridge link:** `cartridge.gameId` references `game.id`; `cartridge.nfcId` is the public token in `/nfc/[id]` URLs (`models/cartridge.ts:1-7`).

## Error Handling

Route handlers never throw to Next.js; each wraps its whole body in `try/catch` and maps failures to a JSON error.

- **Shape:** `NextResponse.json({ error: '<Human message>' }, { status })`, optionally with `details` (`app/api/rom/[slug]/route.ts:113-116`). Success bodies are the raw entity or array, or `{ ok: true, … }` / `{ updated: true }` for actions.
- **Status codes:** 400 missing input (`app/api/nfc/validate/route.ts:14`), 404 not found or inactive (`app/api/nfc/validate/route.ts:21`), 500 in the outer `catch` (`app/api/nfc/validate/route.ts:34`), 201 on create (`app/api/admin/games/route.ts:65`).
- **Degrade, don't fail:** storage errors in `lib/` are caught, logged with `console.warn`, and replaced by mock data (`lib/data.ts:22-24`, `lib/r2.ts:93-97`). Library helpers return `null` for "unavailable" rather than throwing (`lib/r2.ts:62-66`). Only `getMongoClient` throws, on missing `MONGODB_URI` (`lib/mongo.ts:14-16`), and its callers catch it.
- **Rule for new code:** keep the try/catch + JSON error pattern, return 404 for inactive entities as well as missing ones, and never echo secrets or raw stack traces in `details`.

## Logging

All logging is `console.*` with a bracketed area prefix; there is no logging library.

- Prefixes in use: `[api]`, `[data]`, `[rom]`, `[r2]`, `[auth]`, `[http]`, `[error]`, `[logs]`, `[admin]`, `[middleware]`, `[emulator cores]`.
- Helpers: `logRequest` / `logError` (`lib/http-logger.ts:1-7`) and `logAuthEvent` (`lib/auth-config.ts:25-27`). Use them where they fit; otherwise follow the `console.info('[area] message', details)` form.
- The client emulator posts its own diagnostics to `POST /api/logs`, which just echoes them to the server console (`app/api/logs/route.ts:3-7`).
- Watch out: `[auth] admin login rejected` logs the expected admin username (`auth.ts:31`). Do not log credentials, tokens or env values.

## Configuration and Env Vars

Configuration comes only from environment variables, read lazily at call time and trimmed.

- Pattern: a local `getEnvVar(name)` that returns a trimmed string or `''` (`lib/mongo.ts:3-6`, `lib/r2.ts:7-10`). It is copy-pasted per module, not shared; reuse the one in the module you are editing or extract it to `lib/` when touching several.
- Every variable has a working default or a "not configured" branch, so the app runs with none set (`lib/r2.ts:53-60`, `lib/auth-config.ts:6-11`, `auth.ts:7`).
- Names are documented in `.env.example`: `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ROOMS_KEY`. Local values go in `.env.local` (git-ignored, `.gitignore` "Environment" block).
- Watch out: a root `.env` and `cookies.txt` are tracked in git and not covered by `.gitignore`. Never add secrets to them; prefer `.env.local`.

## Code Style

TypeScript strict mode is the only enforced style rule; there is no ESLint or Prettier config in the repo.

- `strict: true`, `noEmit`, bundler resolution (`tsconfig.json:7-11`); type checking runs inside `next build`.
- Observed formatting: 2-space indent, single quotes, semicolons, no trailing commas.
- `'use client'` at the top of every interactive component and client page (`app/admin/page.tsx:1`); server pages (`app/rooms/[slug]/page.tsx`) call `lib/` directly.
- Styling is Tailwind utility classes inline in JSX; content globs cover `app/**` and `components/**` only (`tailwind.config.ts:4`).
- Language: identifiers, comments and API error messages are English; user-facing UI copy is largely Portuguese (`app/admin/page.tsx:26`, `lib/auth-config.ts:19`). Keep new UI copy consistent with the screen it lives on.

## Commit and Branch Conventions

No commit-message convention is enforced. Recent history uses short free-form messages (`update ok`, `update campo e IE`) on `main`. Feature work driven by the ADD framework follows `.claude/skills/add--id-convention/SKILL.md` for branch and feature IDs.

## Related

- [architecture.md](architecture.md): layer order and boundaries behind the Layering row
- [workflows.md](workflows.md): commands that check these rules (build, tests, E2E)
- [domains/backend.md](domains/backend.md): route-handler and auth specifics
- [domains/database.md](domains/database.md): collection-level detail behind the ORM and Entity rows
