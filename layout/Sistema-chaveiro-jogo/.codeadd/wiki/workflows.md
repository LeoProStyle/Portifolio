---
id: wiki/workflows
type: how-to
area: workflows
description: How to run, seed, test, build and deploy RetroKey — npm scripts on port 3001, env setup from .env.example, MongoDB seeding, node --test unit tests, Playwright E2E QA, ROM storage setup and Vercel deploy. Read before running the app or validating a change.
sources: ["*.{json,md}", .env.example, scripts/seed.ts, tests/**, lib/**, .codeadd/settings.json, docs/**, .gitignore]
commit: 17bd8acf
generated: 2026-11-05
tags: [validation-gates, dev-setup, seed, node-test, playwright, vercel]
---

# Workflows

## TL;DR

Install, optionally copy `.env.example` to `.env.local`, then `npm run dev` on http://localhost:3001 — the app works with no env vars by falling back to mock data. Validation gates are `npm run build` (includes type checking) and the `node --import tsx --test` unit suite; there is no lint or format gate. E2E QA uses `@playwright/test` specs under `e2e/`. Deploys go to Vercel with `npm run build`.

## TOC

- [Local Dev Setup](#local-dev-setup)
- [Validation Gates](#validation-gates)
- [Test Workflow](#test-workflow)
- [Seeding Data](#seeding-data)
- [ROM Storage Setup](#rom-storage-setup)
- [Build and Deploy](#build-and-deploy)
- [Related](#related)

## Local Dev Setup

Three steps get a working app; MongoDB and R2 are optional.

1. **Node:** use Node 20.x (`package.json:12-14`). README still says "Node.js 18+" (`README.md:35`) — that is stale; Vercel enforces the `engines` value.
2. **Install:** `npm install`.
3. **Env (optional):** copy `.env.example` to `.env.local` and fill only what you need. Groups:
   - `MONGODB_URI`, `MONGODB_DB` — persistence; without them reads use mock data and admin game writes go to process memory.
   - `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` — admin login; when both admin vars are unset the dev fallback in `lib/auth-config.ts:6-11` applies and the login page shows a hint (`lib/auth-config.ts:17-23`). Set real values outside local dev.
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ACCOUNT_ID` or `R2_ENDPOINT`, `R2_ROOMS_KEY` — ROM and rooms storage.
4. **Run:** `npm run dev` → Next dev server on port 3001 (`package.json:6`). Stop anything else on 3001 first (`README.md:128-129`).

Smoke path: open `/nfc/demo` — the `demo` NFC id is an active mock/seed cartridge (`scripts/seed.ts:44-48`) — and it should redirect to `/play/super-retro`. Admin: `/login`, then `/admin`.

## Validation Gates

Run these before declaring a change done; they are the only gates the repo defines.

```json
{"validation_gates":{"typecheck":"(part of build)","build":"npm run build","test":"node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts"}}
```

| Intent | Command | Notes |
|---|---|---|
| build | `npm run build` | `next build`; also runs TypeScript strict type checking (`tsconfig.json:7`), so no separate typecheck gate |
| test | `node --import tsx --test tests/*.test.ts` | Only `npm run test:auth` is scripted (`package.json:10`) and it runs one file; pass all files explicitly. Node 20 does not expand globs itself — rely on your shell (Git Bash/zsh) or list the files, as in the JSON above |
| lint | — | No ESLint config or `lint` script; `next lint` is not set up |
| format | — | No Prettier or formatter |

There is no CI config (`.github/` absent); gates run locally and Vercel runs only the build.

## Test Workflow

Two separate suites exist and must not be mixed.

**Unit / integration — `tests/*.test.ts`.** Built-in `node:test` + `node:assert/strict`, executed through `tsx` so TypeScript and the `@/` alias resolve (`tests/rooms-data.test.ts:1-4`). They exercise `lib/` directly with no server:

- they read `process.env` live, so they assume R2 is *not* configured (`tests/rooms-data.test.ts:6-10`, `tests/rooms-data.test.ts:27-30`). Run them in a shell without `R2_*` vars exported, or they fail;
- `tests/auth-config.test.ts` mutates `ADMIN_*` env vars in-process (`tests/auth-config.test.ts:6-7`, `tests/auth-config.test.ts:18-19`).

New unit tests go in `tests/<subject>.test.ts`, import from `../lib/...`, and target pure `lib/` helpers. Route handlers have no unit tests; cover them through E2E.

**E2E QA — `e2e/<surface>.qa.spec.ts`.** `@playwright/test` with `@axe-core/playwright` (`package.json:24-25`). Conventions, selectors, screenshot paths and the managed app lifecycle live in `.claude/skills/qa-project/SKILL.md`; the QA base URL, viewports and boot hint (`npm run dev`) live in the `qa` section of `.codeadd/settings.json`. The `e2e/` folder and a `playwright.config` do not exist yet — the first spec creates them.

- Run one spec: `npx playwright test e2e/<surface>.qa.spec.ts`.
- Run all: `npx playwright test e2e/` — keep the `e2e/` filter so Playwright never picks up `tests/*.test.ts`.
- Admin screens need a login; read `ADMIN_USERNAME` / `ADMIN_PASSWORD` from the environment, never hardcode them in a spec.

## Seeding Data

`npm run seed` runs `tsx scripts/seed.ts` (`package.json:9`) to put three sample games and three cartridges into MongoDB.

- Requires `MONGODB_URI` (and optionally `MONGODB_DB`, default `retrokey`, `lib/mongo.ts:35`) in the shell environment. `tsx` does not load `.env.local` the way Next does — export the vars first.
- Idempotent per collection: it inserts only into an empty collection and skips otherwise (`scripts/seed.ts:72-86`). To reseed, drop the collection.
- Seed and mock data use the same `id`s and slugs (`game-1`/`super-retro`, `cartridge-1`/`demo`), so behaviour matches with or without Mongo.
- Seeded `romPath` values point at `/roms/*.bin` under `public/` (`scripts/seed.ts:14`); those ROM files are not in the repo.

## ROM Storage Setup

ROMs are never committed (`public/roms/`, `*.bin`, `*.nes`, `*.smc`, `*.zip` are git-ignored) and are served only through `/api/rom/[slug]`.

- **Local:** put files in `public/roms/` and set the game's `romPath` to `/roms/<file>` (`docs/ROM_SETUP.md:5-27`), or upload through the admin Games tab — without R2 the upload is written to `public/roms/` (`lib/r2.ts:117-120`).
- **R2:** set the `R2_*` vars; admin uploads then go to `roms/<slug>.<ext>` in `R2_BUCKET_NAME` and `romPath` stores that key (`lib/r2.ts:131-144`). The API token needs object-write permission (`README.md:30`).
- **Rooms:** upload a JSON array of `Room` objects to the same bucket under `R2_ROOMS_KEY` (default `rooms.json`, `lib/r2.ts:30-32`).
- On Vercel the filesystem is read-only at runtime, so the local `public/roms/` fallback only works for files present at build time; production needs R2.

## Build and Deploy

Deployment is Vercel's Next.js preset with the default commands (`vercel.json:1-5`).

1. Verify locally: `npm run build`, then `npm start` (port 3001, `package.json:8`).
2. Push to the branch connected in Vercel; Vercel runs `npm install` and `npm run build` on Node 20.x.
3. Configure env vars in the Vercel dashboard — at minimum `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, plus the `R2_*` set for ROMs and rooms (`README.md:142-145` lists only the Mongo vars and is incomplete).

No release tagging, changelog automation or CI pipeline is discoverable; a deploy is whatever reaches the connected branch.

## Related

- [conventions.md](conventions.md): env-var access rules, error and logging conventions the gates do not check
- [architecture.md](architecture.md): which fallbacks each env var switches on or off
- [domains/database.md](domains/database.md): collections and seed data detail
- [domains/backend.md](domains/backend.md): admin routes, auth and ROM streaming behind these workflows
