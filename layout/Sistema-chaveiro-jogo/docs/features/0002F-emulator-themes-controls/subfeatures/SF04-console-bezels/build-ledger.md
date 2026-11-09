# Build ledger — feature: SF04-console-bezels — plan: docs/features/0002F-emulator-themes-controls/subfeatures/SF04-console-bezels/plan.md

Preflight: T03 produces `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>`, `bezelObjectKey(id: BezelConsoleId): string` — T05 consumes both — match
Preflight: T04 produces `createR2Client(): S3Client | null` — T05 consumes it — match
Preflight: T03 produces `isBezelConsoleId`, `BEZEL_MAX_BYTES = 2097152`, `BEZEL_MAX_REQUEST_BYTES = BEZEL_MAX_BYTES + 65536`, `hasPngSignature(bytes: Uint8Array): boolean` — T06 consumes all four — match
Preflight: T05 produces `type BezelStorage`, `getBezelStorage()`, `putBezel`, `getBezel`, `deleteBezel` — T06 consumes all five — match character for character
Preflight: T03 produces `type BezelConsoleId` — T07 consumes it — match
Preflight: T07 produces `onStatusChange?: (state: EmulatorStatus, ...)`, `useWideScreen(): boolean`, `PlayBezel({ consoleId, onLoaded, onFailed }: PlayBezelProps)` — T09 consumes all three — match
Preflight: T08 produces `theme.extend.screens.wide = { raw: '(min-width: 1024px) and (pointer: fine)' }` — T09 consumes it — match
Preflight: T03 produces `type BezelConsoleId`, `isBezelConsoleId`, `isBezelAspectOff(width: number, height: number): boolean` — T10 consumes all three — match
Preflight: T01 (tests/bezel.test.ts) vs T03/T05/T06 — shared interface = lib exports in plan.md Backend "lib exports (exact signatures)"; test file imports only lib modules — no conflict
Preflight: T02 (e2e specs) vs T07/T08/T09/T10 — shared selectors `[data-window]`, `[data-mode]`, `.play-bezel-img`, tab button "Bezels", heading "Bezel por console" — all named in plan.md Frontend — no conflict
Preflight: T01 self — Files tests/bezel.test.ts; Deps -; Consumes -; Produces - — consistent
Preflight: T02 self — Files e2e/play-screen.qa.spec.ts, e2e/admin.qa.spec.ts; Deps -; Produces - — consistent
Preflight: T03 self — Files lib/bezel-console.ts covers all Produces; Deps T01 — consistent
Preflight: T04 self — Files lib/r2.ts covers createR2Client — consistent
Preflight: T05 self — Files lib/bezel.ts covers Produces; Deps T01, T03, T04 cover Consumes — consistent
Preflight: T06 self — Files lib/bezel-routes.ts + 2 route files cover Produces; Deps T01, T03, T05 cover Consumes; `SessionReader` exists in lib/auth-guard.ts:54 — consistent
Preflight: T07 self — Files cover Produces; Deps T02, T03 cover Consumes — consistent
Preflight: T08 self — Files tailwind.config.ts, StatusStrip, PlayTopBar cover Produces — consistent
Preflight: T09 self — Files cover ThemedFrame/PlayFrameMode; Deps T02, T07, T08 do NOT list T03 although Consumes names `BezelConsoleId` (T03) — gap (transitive via T07 Deps T03)
Preflight: T10 self — Files BezelsTab.tsx + app/admin/page.tsx cover Produces; Deps T02, T03, T06 cover Consumes — consistent
Preflight: T11 self — Files AGENTS.md; Deps T06 — consistent
Ruling: T09 runs after T07, which depends on T03, so the missing T03 in T09 Deps needs no reorder — T07 Deps already force T03 first — costs nothing if wrong, the order is the same either way
Impact (2026-11-09, root index C:\Users\leonardoaa\Desktop\MeuPortifolio\Portifolio, 2 commits behind HEAD): lib/r2.ts getR2BucketName CRITICAL (5 direct, 10 total, 7 processes: admin games POST/PUT, rom GET, rooms GET, RoomPage) — use only, never edit
Impact: lib/r2.ts getR2Endpoint CRITICAL (5 direct, 10 total, same 7 processes) — use only, never edit
Impact: lib/r2.ts hasR2Config CRITICAL (2 direct, 6 total, 6 processes) — read by new createR2Client only, body unchanged
Ruling: getR2BucketName measured CRITICAL, not HIGH as plan.md recorded — T04 still only adds a new export and edits none of the three — costs a break in the rom and admin game routes if an existing line in lib/r2.ts changes, so T04 Verify requires git diff with no removed line
Impact: Emulator UNKNOWN (JSX not indexed) — text search callers: components/PlayStage.tsx
Impact: StatusStrip UNKNOWN — text search callers: components/PlayStage.tsx, components/ThemedFrame.tsx
Impact: PlayTopBar UNKNOWN — text search callers: components/PlayStage.tsx
Impact: ThemedFrame UNKNOWN — text search callers: components/PlayStage.tsx
Impact: PlayStage UNKNOWN — text search callers: app/play/[slug]/page.tsx
Impact: AdminPage UNKNOWN — text search: default export of app/admin/page.tsx, page route /admin, no importer
Middleware: matcher ['/admin/:path*'] (middleware.ts:19, read only) — /api/bezel/** and /api/admin/bezels/** are outside it
T01: detect-changes NOT VERIFIED (0 changes seen; untracked file not indexed) — git diff list: tests/bezel.test.ts, docs/features/0002F-emulator-themes-controls/subfeatures/SF04-console-bezels/build-ledger.md
T01: complete (commits e3e114f5300a1150c990a7d2d3958d6e86074bdb..af265648ce7f8b93989ae1366dd5f815b053e3a0, BUILD_STATUS=pass, validation at area end)
T02: detect-changes NOT VERIFIED (index 2+ commits behind; spec files only) — git diff list: e2e/admin.qa.spec.ts, e2e/play-screen.qa.spec.ts
T02: red run --project=main 62 tests, 12 passed, 49 failed, 1 skipped — failures on missing Bezels tab, [data-window], .play-frame-area[data-mode], .play-skeleton, panel Back home, title 16px
T02: spec assumes for T10 — Upload button name starts "Upload", Remove starts "Remove", "Try again", text "New file", one combobox, input[type=file], current preview img[src^="blob:"], checking skeleton has animate-pulse
