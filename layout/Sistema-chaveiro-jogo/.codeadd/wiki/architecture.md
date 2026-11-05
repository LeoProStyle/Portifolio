---
id: wiki/architecture
type: explanation
area: architecture
description: RetroKey system shape — one Next.js 14 App Router app with pages, route handlers, a lib/ data-access tier and models/ types; storage fallbacks (MongoDB, Cloudflare R2, mock data, local public/roms) and the NFC-cartridge-to-emulator flow. Read before adding a route, a storage path or a new layer.
sources: [app/**, components/**, lib/**, models/**, "*.{ts,json,md}", public/emulator.html, docs/**, .gitignore]
commit: 17bd8acf
generated: 2026-11-05
tags: [nextjs-app-router, layering, fallback-storage, cloudflare-r2, mongodb, emulatorjs]
---

# Architecture

## TL;DR

RetroKey is a single Next.js 14 App Router application (no monorepo, no workspaces) that turns an NFC-style **cartridge** into a playable browser **game** session. Code flows one way: `app/` (pages + route handlers) → `components/` → `lib/` → `models/`. Every storage backend is optional — MongoDB, Cloudflare R2 and the filesystem each degrade to mock or in-memory data, so the app boots with zero env vars. Admin auth exists (NextAuth v5 credentials) but only the `/admin` page checks it, client-side; the admin API is not guarded server-side.

## TOC

- [System Shape](#system-shape)
- [Layer Hierarchy](#layer-hierarchy)
- [Boundaries and External Services](#boundaries-and-external-services)
- [Core Flow: Cartridge to Emulator](#core-flow-cartridge-to-emulator)
- [Entry Points](#entry-points)
- [Why It's Built This Way](#why-its-built-this-way)
- [Watch Out When Changing](#watch-out-when-changing)
- [Related](#related)

## System Shape

The repo holds one deployable Next.js app at the root, with one `package.json` and no workspaces (`package.json:1-35`). Path alias `@/*` maps to the repo root (`tsconfig.json:17-19`), so imports read `@/lib/data`, `@/models/game`.

| Folder | Role |
|---|---|
| `app/` | Routes: server and client pages (`app/**/page.tsx`) and REST route handlers (`app/api/**/route.ts`) |
| `components/` | Client UI: admin tabs, login form, rooms list, the emulator iframe shell |
| `lib/` | Server-side data access and helpers: Mongo client, R2 client, merged read model, in-memory admin store, mock data, emulator core mapping, loggers |
| `models/` | Plain TypeScript entity types (`Game`, `Room`, `Cartridge`) |
| `public/emulator.html` | Standalone EmulatorJS host page loaded inside an iframe |
| `scripts/seed.ts` | One-shot MongoDB seeder |
| `auth.ts`, `middleware.ts` | NextAuth v5 config and the (currently inert) Next middleware |

Deploy target is Vercel (`vercel.json:1-5`) on Node 20.x (`package.json:12-14`). The domain pages own the per-area detail; this page only fixes the shape.

## Layer Hierarchy

Dependencies point inward only: `app/**` → `components/**` → `lib/*` → `models/*`. `models/` imports nothing internal; `lib/` never imports from `app/` or `components/`. The code graph confirms no reverse edges — query it (GitNexus repo `Portifolio`, `IMPORTS` edges) rather than relying on a list here.

```
app/**/page.tsx ──► components/** ──► lib/emulator-cores, lib/auth-config
app/api/**/route.ts ──► lib/data ──► lib/mongo, lib/r2, lib/mock-data ──► models/*
app/api/admin/**    ──► lib/mongo, lib/r2, lib/admin-store            ──► models/*
```

Two tiers of data access exist in `lib/` and they are not equivalent:

- **Read model — `lib/data.ts`.** Public reads (games, cartridges, rooms, NFC validation) go through it. It merges mock games with Mongo games keyed by normalized slug (`lib/data.ts:15-38`), so mock entries are always visible even when Mongo is up.
- **Admin writes — straight to `lib/mongo.ts`.** Admin route handlers call `getDb()` and the collections directly, with `lib/admin-store.ts` as an in-memory fallback for games only (`app/api/admin/games/route.ts:38-74`). Cartridge admin routes have no fallback and return 500 without Mongo (`app/api/admin/cartridges/route.ts:5-13`).

There is no service or repository layer between route handlers and the driver; route handlers own request parsing, persistence and response shaping. New public read paths belong in `lib/data.ts`; do not introduce a parallel read helper.

## Boundaries and External Services

All external I/O happens server-side, in route handlers or `lib/`. Client components only talk to the app's own `/api/*` endpoints via `fetch` (e.g. `components/admin/GamesTab.tsx:39`, `app/nfc/[id]/page.tsx:13`).

| Boundary | Through | Fallback when absent |
|---|---|---|
| MongoDB (`games`, `cartridges` collections) | official `mongodb` driver, singleton client promise (`lib/mongo.ts:8-31`) | mock data (`lib/data.ts:22-24`), in-memory admin store (`lib/admin-store.ts:5-6`) |
| Cloudflare R2 — ROM objects | `@aws-sdk/client-s3` `PutObject`/`GetObject` (`lib/r2.ts:117-150`, `app/api/rom/[slug]/route.ts:45-78`) | local `public/roms/` write (`lib/r2.ts:105-115`) and read (`app/api/rom/[slug]/route.ts:121-135`) |
| Cloudflare R2 — `rooms.json` | `readRoomsFromR2` (`lib/r2.ts:62-98`) | `mockRooms` (`lib/r2.ts:100-103`) |
| EmulatorJS | CDN script loaded by `public/emulator.html:36-41`, inside an iframe built by `components/Emulator.tsx:134` | none — the play page needs network access to the CDN |
| Auth | NextAuth v5 credentials provider against env-configured admin (`auth.ts:5-54`) | dev defaults from `lib/auth-config.ts:6-11` |

R2 is "configured" only when key id, secret, bucket and endpoint (explicit `R2_ENDPOINT` or derived from `R2_ACCOUNT_ID`) are all set (`lib/r2.ts:12-24`, `lib/r2.ts:53-60`). ROMs and `rooms.json` share the same `R2_BUCKET_NAME`.

## Core Flow: Cartridge to Emulator

The product's single critical path: an NFC route validates a cartridge, then the play page streams the ROM into EmulatorJS.

1. `/nfc/[id]` (client page) POSTs `{ nfcId }` to `/api/nfc/validate` (`app/nfc/[id]/page.tsx:13`).
2. `validateCartridge` finds an `active` cartridge by `nfcId`, then an `active` game by `cartridge.gameId` (`lib/data.ts:66-82`); the handler answers `redirectTo: /play/<slug>` (`app/api/nfc/validate/route.ts:26-31`).
3. `/play/[slug]` fetches `/api/game/<slug>` (`app/play/[slug]/page.tsx:21`) — note the `[id]` segment is actually a slug (`app/api/game/[id]/route.ts:6`) — and maps `game.system` to an EmulatorJS core via `getCoreForSystem` (`lib/emulator-cores.ts:51`).
4. `components/Emulator.tsx` iframes `/emulator.html?…` (`components/Emulator.tsx:134`), which requests `/api/rom/<slug>`.
5. `/api/rom/[slug]` treats a `romPath` starting with `roms/` as an R2 key, otherwise reads `public/<romPath>` from disk, and streams bytes back (`app/api/rom/[slug]/route.ts:90-135`). ROMs are never linked directly by URL.

Rooms are a separate read-only surface: `/api/rooms`, `/api/rooms/[slug]` and the server page `app/rooms/[slug]/page.tsx` all read through `getRooms`/`getRoomBySlug` (`lib/data.ts:84-97`).

## Entry Points

- HTTP pages: `app/layout.tsx` (root layout wrapping `SessionProvider` via `app/Providers.tsx`), then each `app/**/page.tsx`.
- HTTP API: each `app/api/**/route.ts` exports `GET`/`POST`/`PUT`/`DELETE` handlers.
- Auth: `app/api/auth/[...nextauth]/route.ts` re-exports `handlers` from `auth.ts`.
- Middleware: `middleware.ts` — matcher is empty (`middleware.ts:9-11`), so it runs on nothing.
- CLI: `scripts/seed.ts` (via `npm run seed`).
- Emulator host: `public/emulator.html`.

For callers and dependents of any of these, ask the code graph (`context`/`impact` with `repo: "Portifolio"`), not this page.

## Why It's Built This Way

The rationale comes from the PRD and README, which are the project's primary design docs.

- **Optional everything, mock fallback first.** "Support local development with mock data and optional MongoDB" and "Clear fallback behavior when database services are unavailable" are stated goals (`RetroKey.md:14-15`, `RetroKey.md:63`). That is why every `lib/` accessor swallows connection errors and returns mock data.
- **ROMs only through the API.** "ROM files are routed through the app API layer rather than exposed directly" (`RetroKey.md:97`, `docs/ROM_SETUP.md:82-83`), so ROM delivery stays behind `/api/rom/[slug]` and `public/roms/` is git-ignored (`.gitignore`, "ROM files" block).
- **R2 for large binaries.** ROM uploads moved to Cloudflare R2 because ROMs are too large for the repo or the Vercel bundle (`README.md:26-27`, recent commit `32c0ab51 update- 100mb`).
- **Route handlers instead of a separate backend.** "App Router structure with route handlers" is a non-functional requirement (`RetroKey.md:62`); there is no standalone API server.

## Watch Out When Changing

- **Admin API is unauthenticated server-side.** `/admin` redirects anonymous users client-side only (`app/admin/page.tsx:14-21`); no route handler calls `auth()`, and `middleware.ts` matches nothing. The docs claim "Admin access is protected by a session-based flow" (`RetroKey.md:103`) — the code does not enforce it for `/api/admin/**`. Any new admin endpoint must add its own guard or fix the middleware matcher.
- **Read model and admin writes can disagree.** Public reads merge `mockGames` + Mongo; admin lists show only Mongo (or only the in-memory store). A game created while Mongo is down lives only in process memory and vanishes on restart or on another serverless instance.
- **`app/api/rom/[slug]/route.ts` builds its own S3 client** and duplicates `hasR2Config` from `lib/r2.ts`. Change R2 config rules in both places, or consolidate into `lib/r2.ts`.
- **Stale doc:** `docs/ROM_SETUP.md:58-67` describes returning a signed R2 URL; the code streams the object bytes instead. It also lists cores `nes`/`snes`/… while the code maps systems to concrete cores (`fceumm`, `snes9x`, …) in `lib/emulator-cores.ts:30-45`.
- **Stale doc:** README's folder table says `models/` holds users and sessions types (`README.md:9`); only `Game`, `Room` and `Cartridge` exist.

## Related

- [domains/backend.md](domains/backend.md): route handler patterns, auth, R2 and ROM streaming in detail
- [domains/database.md](domains/database.md): MongoDB client, collections, seed data and the mock fallback
- [domains/frontend.md](domains/frontend.md): pages, admin tabs and the emulator iframe shell
- [conventions.md](conventions.md): Stack Conventions table, naming, error-handling rules
