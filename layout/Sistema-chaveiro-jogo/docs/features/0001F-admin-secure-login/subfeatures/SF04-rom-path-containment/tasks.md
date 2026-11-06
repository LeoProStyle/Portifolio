# Tasks: 0001F-SF04 rom-path-containment

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 6 |
| Services | test, backend, frontend |

## Requirements Coverage

- [x] RF01 — `romPath` gerado no servidor via `buildRomObjectKey`
- [x] RF02 — `romPath` vindo do corpo ignorado em criação e edição
- [x] RF03 — `GET /api/rom/[slug]` só lê `romPath` aceito; o resto responde 404
- [x] RF04 — o arquivo vem do `romFile` multipart da aba de jogos
- [x] RF05 — PUT sem arquivo novo preserva o `romPath` gravado
- [x] RF06 — reenviar o arquivo gera um `romPath` novo
- [x] RN01 — `/api/rom/[slug]` continua acessível sem login
- [x] RN02 — caminho local aceito só dentro de `public/roms`
- [x] RN03 — `roms/<slug>.<ext>` exato (sem barra) é R2; `/roms/` é local; o resto é recusado

## TDD

- [x] T-TEST-01 Contract tests for RN02/RN03/RF03 (T01-T05) and write helpers RF01/RF02/RF05/RF06 (T06) — `tests/rom-path.test.ts`
- [x] T-TEST-02 E2E contract for RN01/RF03 (T07) and RF02 (T08) — `e2e/rom-path.qa.spec.ts`

## Execution

- [x] T01 Write rom-path unit tests T01-T06
  - Service: test
  - Files: `tests/rom-path.test.ts`, `lib/rom-path.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/rom-path.test.ts` fails red (stub `lib/rom-path.ts` bodies throw) before T03, green after T03; `npx tsc --noEmit -p .` exits 0
- [x] T02 Author ROM path E2E spec T07, T08
  - Service: test
  - Files: `e2e/rom-path.qa.spec.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `npx playwright test e2e/rom-path.qa.spec.ts --project=main` — T07 red before T04 (404 body echoes `details`), T08 red before T05; both green after
- [x] T03 Implement romPath classifier and write helpers
  - Service: backend
  - Files: `lib/rom-path.ts`
  - Deps: T01
  - Consumes: -
  - Produces: `classifyRomPath(romPath: unknown, publicDir?: string): RomLocation`, `romPathForCreate(uploaded: string | undefined): string`, `romPathForUpdate(uploaded: string | undefined): { romPath?: string }`
  - Verify: `node --import tsx --test tests/rom-path.test.ts` exits 0
- [x] T04 ROM route reads only accepted romPath, 404 without echo
  - Service: backend
  - Files: `app/api/rom/[slug]/route.ts`
  - Deps: T02, T03
  - Consumes: `classifyRomPath(romPath: unknown, publicDir?: string): RomLocation` (T03)
  - Produces: -
  - Verify: `npm run build` exits 0 and `npx playwright test e2e/rom-path.qa.spec.ts --project=main` T07 green
- [x] T05 Game handlers derive romPath from the upload only
  - Service: backend
  - Files: `app/api/admin/games/route.ts`, `app/api/admin/games/[id]/route.ts`
  - Deps: T02, T03
  - Consumes: `romPathForCreate(uploaded: string | undefined): string` (T03), `romPathForUpdate(uploaded: string | undefined): { romPath?: string }` (T03)
  - Produces: -
  - Verify: `npm run build` exits 0; `npx playwright test e2e/rom-path.qa.spec.ts e2e/admin.qa.spec.ts --project=main` green (T08 and SF01 regression)
- [x] T06 GamesTab shows romPath read-only
  - Service: frontend
  - Files: `components/admin/GamesTab.tsx`
  - Deps: T05
  - Consumes: -
  - Produces: -
  - Verify: `npm run build` exits 0; `npx playwright test e2e/admin.qa.spec.ts --project=main` green

## Acceptance Checklist

- [x] `classifyRomPath` accepts only `roms/<slug>.<ext>` matching `^roms/[a-z0-9-]+\.[a-z0-9]+$` as R2 (RN03, RF01)
- [x] `classifyRomPath` accepts `/roms/...` only when `path.resolve(publicDir, '.' + romPath)` stays inside `publicDir/roms/`, and rejects `..`, absolute, backslash and NUL paths (RN02, RF03)
- [x] `/api/rom/[slug]` serves R2 for `r2`, the file for `local`, and 404 `{error:'ROM not found'}` with a `[rom] rejected romPath {slug, reason}` log for `rejected`; no response body carries a path (RF03)
- [x] `/api/rom/[slug]` still answers without a session (RN01)
- [x] POST stores `romPathForCreate(uploaded)`: the upload's path, or `''` without file; `body.romPath` is never read (RF01, RF02, RF04)
- [x] PUT spreads `romPathForUpdate(uploaded)` into `$set` and the in-memory update, so an edit without file keeps the stored value and a re-upload replaces it (RF05, RF06)
- [x] `GamesTab` no longer lets the admin type a `romPath`; it shows the current one read-only (RF02, RF04)
- [x] `requireAdmin(request)` is still the first statement of every game handler (RN01 of SF01)

## Validation Gates

- [x] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
