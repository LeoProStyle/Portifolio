# Build ledger — feature: 0002F — plan: docs/features/0002F-emulator-themes-controls/subfeatures/SF01-play-screen-themes/plan.md

Preflight: T04 produces `resolveEmulatorSystem(system?: string|null): EmulatorSystem | null`, T05 consumes the same string — match
Preflight: T05 produces `type FrameStyle = (typeof FRAME_STYLES)[number]`, T08 consumes the same string — match
Preflight: T05 produces `resolvePlayTheme(...)` and `playThemeCssVars(...)`, T09 consumes both — match
Preflight: T06 produces `Emulator(props: {...onStatusChange?...})`, T09 consumes the same string — match
Preflight: T07 produces `type PlayScreenState`, `StatusStrip(...)`, `PlayTopBar(...)`; T08 and T09 consume them — match
Preflight: T08 produces `ThemedFrame(...)`, T09 consumes the same string — match
Preflight: T09 produces `type PlayGameMeta`, `type MetaState`, `PlayStage(...)`; T10 consumes all three — match
Preflight: T01, T02, T03 (test) — Files cover the test only, Produces -, Deps - — self-consistent
Preflight: T04 — Files lib/emulator-cores.ts covers Produces; Deps T01 — self-consistent
Preflight: T05 — Files lib/play-theme.ts covers Produces; Deps T02, T04 cover Consumes (T04) — self-consistent
Preflight: T06 — Files components/Emulator.tsx covers Produces; Deps - — self-consistent
Preflight: T07 — Files StatusStrip.tsx, PlayTopBar.tsx cover Produces; Deps - — self-consistent
Preflight: T08 — Files ThemedFrame.tsx, app/globals.css cover Produces; Deps T05, T07 cover Consumes — self-consistent
Preflight: T09 — Files PlayStage.tsx covers Produces; Deps T05-T08 cover Consumes — self-consistent
Preflight: T10 — Files app/play/[slug]/page.tsx; Deps T03, T09 cover Consumes (T09) — self-consistent
Preflight: T11 — Files AGENTS.md; Deps T04, T05 — self-consistent
Preflight: T06 type note — Emulator.core is optional today (`core?: string`); Produces declares `core: string`, the only caller passes a string — no conflict
Impact: getCoreForSystem upstream LOW, 1 caller PlayPage (GitNexus, exact). Emulator upstream UNKNOWN (JSX not indexed); text search: 1 use app/play/[slug]/page.tsx:5
T01: complete (commits f3e3c5b9..a199fe7a, BUILD_STATUS=n/a (test-only, RED confirmed: 3 resolveEmulatorSystem cases fail with TypeError, getCoreForSystem table green), validation at area end)
T02: complete (commits a199fe7a..508bef8b, BUILD_STATUS=n/a (test-only, RED confirmed: Cannot find module ../lib/play-theme), validation at area end)
T03: complete (commits 508bef8b..c4b25a36, BUILD_STATUS=n/a (test-only, RED confirmed on --project=main: [data-frame] not found against the current card), validation at area end)
T04: complete (commits c4b25a36..c07cdb27, BUILD_STATUS=pass, tests/emulator-cores.test.ts 4/4, validation at area end)
T05: complete (commits c07cdb27..6014c879, BUILD_STATUS=pass, tests/play-theme.test.ts 14/14, validation at area end)
T06: complete (commits 6014c879..fb412f14, BUILD_STATUS=pass, fallback constants and attempt order unchanged in diff; failed emitted in the 3 exhausted branches only, E2E T08 confirms at T10, validation at area end)
T07: complete (commits fb412f14..63eafd88, BUILD_STATUS=pass, validation at area end)
T08: complete (commits 63eafd88..fac8a56b, BUILD_STATUS=pass, 13/13 [data-frame] rules present, validation at area end)
T09: complete (commits fac8a56b..92883ce3, BUILD_STATUS=pass, validation at area end)
