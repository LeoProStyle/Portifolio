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
T02: complete (commits af265648ce7f8b93989ae1366dd5f815b053e3a0..d99c5a7d047636045987b4668885fe32832c4df6, BUILD_STATUS=pass, validation at area end)
T03: detect-changes NOT VERIFIED (new untracked file) — git diff list: lib/bezel-console.ts; Verify pattern RF02|RN06 exit 0 (3 pass)
T03: complete (commits d99c5a7d047636045987b4668885fe32832c4df6..ab53d380938686a88e25fbdca6d45ab4bd48dce7, BUILD_STATUS=pass, validation at area end)
Ruling: T04 implemented inline by the coordinator, not by a subagent — a 15-line additive export whose impact was already measured and recorded; the skill's When NOT to Use names a single trivial task — costs a missed review only until the backend area validator reads AREA_BASE..HEAD
T04: detect-changes NOT VERIFIED (index behind HEAD) — git diff list: lib/r2.ts (15 added, 0 removed); scratch check createR2Client() null without R2_* exit 0
T04: complete (commits ab53d380938686a88e25fbdca6d45ab4bd48dce7..02440b14d438c089ab6bb6016b2cf5417572288f, BUILD_STATUS=pass, validation at area end)
test: validated (commits e3e114f5300a1150c990a7d2d3958d6e86074bdb..d99c5a7d047636045987b4668885fe32832c4df6, 3 violations, SPEC_STATUS=INCOMPLETE)
test: minor (deferred): TV-2 e2e/play-screen.qa.spec.ts:590-596 T27 position check walks 3 ancestors instead of the strip wrapper
test: minor (deferred): TV-3 e2e/admin.qa.spec.ts T44 "Removing..." asserts Upload disabled with no file chosen; file input not asserted (needs-verification)
test: fix round 1/3 (1 addressed, 0 open; commits 02440b14d438c089ab6bb6016b2cf5417572288f..b7ee50e70ac65614870c556d7820242cbeabb665) — re-review TV-1 ADDRESSED [evidence: tests/bezel.test.ts:564-573; test: tests/bezel.test.ts T12]
T05: detect-changes NOT VERIFIED (new untracked file) — git diff list: lib/bezel.ts; bezel group 9/9, bezel-console 7/7, routes cancelled (module absent until T06)
T05: complete (commits b7ee50e70ac65614870c556d7820242cbeabb665..9f8ddd2d2dc5e60883681ddb19c2fe9d7de987a9, BUILD_STATUS=pass, validation at area end)
T06: middleware matcher re-read ['/admin/:path*'] (middleware.ts:19, read only) — /api/bezel/[console] and /api/admin/bezels/[console] are outside it; admin route guarded by requireAdmin in lib/bezel-routes.ts
T06: detect-changes NOT VERIFIED (new untracked files) — git diff list: lib/bezel-routes.ts, app/api/admin/bezels/[console]/route.ts, app/api/bezel/[console]/route.ts; tests/bezel.test.ts 36/36 without R2_*
T06: complete (commits 9f8ddd2d2dc5e60883681ddb19c2fe9d7de987a9..37f1d85b1f3e27aa7a47f9852743bf66585cd2d1, BUILD_STATUS=pass, validation at area end)
Ruling: tests/bezel-gaps.test.ts stays out of the AGENTS.md test gate; T11 Verify fixes the exact gate command and plan.md lists six files — the gap file still runs under npm test (tests/*.test.ts) — costs the 9 gap cases not running in the validation gate if wrong
backend: test-agent complete (commits 37f1d85b1f3e27aa7a47f9852743bf66585cd2d1..6acd3dbea23b0df1048db95a7fe87d6261d914c4, 9 gap tests, 45/45 green, BLOCKED none)
backend: validated (commits d99c5a7d047636045987b4668885fe32832c4df6..6acd3dbea23b0df1048db95a7fe87d6261d914c4, 0 violations, SPEC_STATUS=complete)
backend: minor (deferred): lib/bezel-routes.ts:231-243 chunked body without Content-Length is parsed by formData() before file.size check — matches plan.md order and Risks row; bounded by platform cap
Ruling: validator's first npm run build failure (next-font-manifest MODULE_NOT_FOUND) treated as a .next race with the T07 agent's concurrent build, not a defect — the re-run and the coordinator's sequential build both exit 0 — costs a hidden build flake if wrong, caught by the clean-.next E2E runs in T09/T10
T07: detect-changes NOT VERIFIED (new untracked files) — git diff list: components/Emulator.tsx (1 line), components/useWideScreen.ts, components/PlayBezel.tsx
T07: complete (commits 6acd3dbea23b0df1048db95a7fe87d6261d914c4..9db6f277b411d1c17ed9162cc178958db687f09b, BUILD_STATUS=pass, validation at area end)
Ruling: T08 implemented inline by the coordinator — three class-level edits whose exact strings plan.md and tasks.md fix; impact for StatusStrip and PlayTopBar already recorded (UNKNOWN, caller PlayStage/ThemedFrame by text search) — costs a missed per-task review only until the frontend area validator reads the range
T08: detect-changes NOT VERIFIED (index behind HEAD) — git diff list: tailwind.config.ts, components/StatusStrip.tsx, components/PlayTopBar.tsx; generated CSS holds (min-width:1024px) and (pointer:fine) with wide\: bg-transparent, block, not-sr-only, shrink-0, static, text-2xl
T08: complete (commits 9db6f277b411d1c17ed9162cc178958db687f09b..d73e33b3200e228a8fe1dc414f734060f78d5351, BUILD_STATUS=pass, validation at area end)
T09: detect-changes NOT VERIFIED (index behind HEAD) — git diff list: components/ThemedFrame.tsx, components/PlayStage.tsx, app/globals.css
T09: e2e play-screen --project=main 38/38, --project=no-mongo 38/38 (clean .next, MONGODB_DB=retrokey_e2e, ports free after)
T09: note — loading-metadata skeleton .play-frame-area carries no data-mode, so the first observed mode in T29 is frame; frontend validator to confirm against plan.md
T09: complete (commits d73e33b3200e228a8fe1dc414f734060f78d5351..d103864ccce92337589b72d8578fda5008dc8240, BUILD_STATUS=pass, validation at area end)
Ruling: e2e/admin.qa.spec.ts SF04-T45 corrected by the coordinator to expect AUTH_ERROR_MESSAGES text per status (403 = 'Sua conta não tem permissão de administrador...') — design.md line 100 only requires that 401 and 403 call the existing onAuthError, and the existing page shows a different text for 403; changing the page copy would alter Games/Cartridges — costs a wrong 403 copy expectation if the owner wanted one text for both
Ruling: BezelsTab keeps the Remove button label "Remove bezel" while deleting and shows "Removing..." as separate text — design.md requires "Removing..." shown and all controls disabled, both hold; the spec locates the button by /^Remove/ — costs a copy deviation in the removing state if wrong
Ruling: BezelsTab derives the aspect warning from the selected file's measured size instead of a 'warning' feedback entry (plan.md local state) — an upload error would otherwise erase the warning while the off-ratio file stays selected — costs a plan.md state-shape deviation, no visible behaviour change
Ruling: statuses outside design.md's table (e.g. 500) show "Upload failed. Try again." / "Remove failed. Try again." — design.md has no copy for them — costs a copy change if the owner wants other text
T10: detect-changes NOT VERIFIED (new untracked file) — git diff list: components/admin/BezelsTab.tsx, app/admin/page.tsx; CartridgesTab.tsx and GamesTab.tsx absent from diff
T10: e2e admin --project=main 23 passed, 1 skipped (no-mongo-only T17), clean .next, MONGODB_DB=retrokey_e2e, ports free after
test: spec fix T45 (commits d103864ccce92337589b72d8578fda5008dc8240..0a710d7c69e750aa9cf5ae3b64e0abb5bbec90d9, build-only — admin e2e main green)
T10: complete (commits 0a710d7c69e750aa9cf5ae3b64e0abb5bbec90d9..77524d381129e15421fcc137ac77814b5f016e78, BUILD_STATUS=pass, validation at area end)
Ruling: no @test-agent for the frontend area — the project has no component test runner (node:test without DOM) and e2e/play-screen + e2e/admin specs (T23-T48) cover every frontend acceptance item — costs uncovered unit-level edge cases in BezelsTab/PlayStage if wrong
Ruling: T11 done inline (one-line AGENTS.md edit); plan.md Global Constraints keeps the old five-file command because plan.md is a frozen spec and AGENTS.md is the source it cites — costs a stale quote in plan.md if a reader trusts it over AGENTS.md
T11: detect-changes NOT VERIFIED (docs-only change) — git diff list: AGENTS.md; six-file gate exit 0, 64 pass, 0 R2_* vars in shell
T11: complete (commits 77524d381129e15421fcc137ac77814b5f016e78..fc11c47d62ac2026bca320bf1228716134edaa95, BUILD_STATUS=pass, validation at area end)
infra: validated (commits 77524d381129e15421fcc137ac77814b5f016e78..fc11c47d62ac2026bca320bf1228716134edaa95, 0 violations, SPEC_STATUS=complete) — coordinator check: AGENTS.md validation_gates.test holds exactly the six-file command, gate run exit 0
frontend: validated (commits 6acd3dbea23b0df1048db95a7fe87d6261d914c4..77524d381129e15421fcc137ac77814b5f016e78, 0 violations, SPEC_STATUS=complete)
tasks.md: merged ticks from test, backend, frontend, infra validators; §1 recomputed (11/11); §5 gates run this session — test gate 64/64 exit 0, npm run build exit 0, detect-changes NOT VERIFIED per task with git diff lists recorded
e2e: deferred to the last subfeature (qa-pipeline delivery authoring) — SF02 and SF03 rows still pending; SF04 specs authored and green via T02/T09/T10
