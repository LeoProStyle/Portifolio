---
id: 0002F-review-001
type: review
created: 2026-11-06
feature: 0002F
scope: [SF01]
branch: feature/0002F-emulator-themes-controls
status: open
---

# Review 001: 0002F-emulator-themes-controls

> **Date:** 2026-11-06 | **Branch:** feature/0002F-emulator-themes-controls
> **QA baseline:** SF01:run-001

## TOC
- [Quality Gate Report](#quality-gate-report)
- [Spec Compliance Audit](#spec-compliance-audit)
- [Code Review Summary](#code-review-summary)
- [Product Validation](#product-validation)
- [QA Judgement](#qa-judgement)
- [Fix Routing](#fix-routing)
- [Resolution Annex](#resolution-annex)

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` → exit 0 |
| Spec Compliance | ⊘ SKIPPED | covered by Final review: passed at ff38df8b653dd10e768741d0afe7e452f09fe738 |
| Code Review Score | ✅ PASSED | 8.5/10 (threshold: ≥ 7) — frontend reviewer, 0 blocker, 0 major |
| Product Validation | ✅ PASSED | RF: 3/3, RN: 3/3 |
| Validation Gates | ✅ PASSED | `npm run build` → exit 0; `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts` → exit 0 (28/28) |
| QA Judgement | ✅ PASSED | SF01 run-001: 0 blocker, 2 major, 9 minor, 2 polish; 14/14 assertions; 0 axe violations |
| **Overall** | **✅ PASSED** | **Ready for merge — 16 routed findings, none blocking** |

> Reviewed at: 2026-11-06
> Reviewed by: /add-review (model: claude-opus-5-5)

## Spec Compliance Audit
Spec audit: SKIPPED — covered by Final review: passed at ff38df8b653dd10e768741d0afe7e452f09fe738. Every in-scope ledger (SF01 `build-ledger.md`) ends in `Final review: passed (after review-000)` with a head line, and nothing outside `docs/features/0002F-emulator-themes-controls` changed after that head. The OWASP pass is skipped for the same reason.

| Slot | Result |
|---|---|
| Test spec coverage (plan.md Test Specification) | 17/17 test cases implemented — T01-T03, T09-T16 in `tests/play-theme.test.ts`, T04 in `tests/emulator-cores.test.ts`, T05-T08, T17 in `e2e/play-screen.qa.spec.ts`; TEST_STATUS = COVERED |

## Code Review Summary
One reviewer dispatched (frontend; the diff has no backend file). 14 changed source files reviewed. Score 8.5/10.

| Category | Findings |
|---|---|
| Patterns | CR-1 (minor), CR-2 (minor), CR-3 (polish) |
| UX | 4 items, each confirmed or refined by QA measurement and carried as QA-02, QA-03, QA-04, QA-10; the fourth (title variant order at 844x390) resolved by measurement into QA-10 |
| Code Quality | `data?: any` in `Emulator.tsx` logEmulator and one `console.error` in the page — both present on main before this diff, not routed |
| Security | none — theme values reach the DOM only as validated custom properties and a closed `data-frame` list; slug URI-encoded |
| Contracts | none — `PlayGameMeta` matches `/api/game/[id]`; layering app → components → lib holds |

## Product Validation

| Item | Status | Evidence |
|---|---|---|
| RF01 | met | `lib/play-theme.ts` 12 themes + neutral; 13 rules in `app/globals.css`; tokens measured equal (QA run-001) |
| RF02 | met | `components/PlayStage.tsx` stage, `app/globals.css` frame sizing; no scroll and exact ratio measured at 3 viewports |
| RF03 | met | stage and bezel drawn by the page around the iframe (`PlayStage.tsx`, `ThemedFrame.tsx`) |
| RN01 | met | `resolvePlayTheme` reads no database; E2E `no-mongo` project green in the build |
| RN02 | met | `isAllowedImageUrl`, `validatePlayTheme`; unit tests green |
| RN03 | met | neutral theme for unknown system, not-found and metadata-error |
| Prerequisites | met | no new data, config or environment variable required |

## QA Judgement

| Scope | Run | Blocker | Major | Minor | Polish | Report |
|---|---|---|---|---|---|---|
| SF01 | run-001 | 0 | 2 | 9 | 2 | [qa-validation-001.md](subfeatures/SF01-play-screen-themes/_tests/run-001/qa-validation-001.md) |

Dual judge (@ux-agent review ∥ @qa-agent), read-PNG mode. Function, layout fit, ratio, states and accessibility pass. The two majors are about the console frames: seven dark frames read alike, and the Game Boy screen escapes its rounded corner.

Product decision recorded during this review: the owner chose image bezels (one PNG per console with a transparent screen window, defined in code). That direction replaces the CSS-bezel look behind QA-01, QA-02, QA-03, QA-05, QA-06 and QA-07; those rows should be worked through the replan, not patched in CSS.

## Fix Routing

| Scope | ID | Severity | Area | Route | File | Symptom | Blocked by |
|---|---|---|---|---|---|---|---|
| SF01 | QA-01 | major | frontend | @frontend-agent | app/globals.css | Seven dark console frames (SMS, Mega Drive, Game Gear, N64, Neo Geo, Arcade, neutral) read as one bezel; RF01 "inspired by the console" not met for them | — |
| SF01 | QA-02 | major | frontend | @frontend-agent | app/globals.css, components/ThemedFrame.tsx | Game Boy / GBC bottom-right radius 60px / 36px and the screen area not clipped to the frame shape; the screen escapes the corner at 390x844 | — |
| SF01 | QA-03 | minor | frontend | @frontend-agent | app/globals.css | Bezel shadow colours hard-coded outside the --t-* token allowlist | — |
| SF01 | QA-04 | minor | frontend | @frontend-agent | components/ThemedFrame.tsx | Retry/Reload use px-5, off the declared spacing steps | — |
| SF01 | QA-05 | minor | frontend | @frontend-agent | app/globals.css | GBA / Game Gear padding-inline clamp(14px, 4vmin, 48px) is an undeclared second deviation (30.72px measured) | — |
| SF01 | QA-06 | minor | frontend | @frontend-agent | app/globals.css | Hard light/dark seam at ~70% of the NES bezel reads as an artifact | — |
| SF01 | QA-07 | minor | frontend | @frontend-agent | app/globals.css | Stray accent bars at different heights on N64 and Neo Geo frames | — |
| SF01 | QA-08 | minor | frontend | @frontend-agent | components/ThemedFrame.tsx | Not-found panel has no visible primary action; Back home is only the small top-bar link | — |
| SF01 | CR-1 | minor | frontend | @frontend-agent | components/PlayStage.tsx | Convoluted `META_TO_SCREEN[metaState === 'ok' ? 'loading' : metaState]` with an unreachable branch | — |
| SF01 | CR-2 | minor | frontend | @frontend-agent | components/PlayStage.tsx | `getCoreForSystem('')` runs while metadata loads or fails and logs "No system selected" for a game never played | — |
| SF01 | QA-11 | minor | e2e | @e2e-agent | e2e/play-screen.qa.spec.ts | loading-metadata state (with Back home and the fullscreen slot) never axe-checked | QA-08 |
| SF01 | QA-09 | minor | frontend | @ux-agent | docs/features/0002F-emulator-themes-controls/subfeatures/SF01-play-screen-themes/design.md | Contract silent on the portrait frame anchor and free-area split (cited: Breakpoint behaviour, 390x844) | — |
| SF01 | QA-10 | minor | frontend | @ux-agent | docs/features/0002F-emulator-themes-controls/subfeatures/SF01-play-screen-themes/design.md | 844x390 title computes to 16px, below the declared text-lg; contract has no landscape value (cited: Typographic scale) | — |
| SF01 | CR-3 | polish | frontend | @frontend-agent | components/Emulator.tsx | `onStatusChange` repeats the status union instead of the exported `EmulatorStatus` | — |
| SF01 | QA-12 | polish | frontend | @frontend-agent | components/PlayTopBar.tsx | Long titles truncate in portrait while the system label repeats the console name | — |
| SF01 | QA-13 | polish | frontend | @ux-agent | docs/features/0002F-emulator-themes-controls/subfeatures/SF01-play-screen-themes/design.md | Full-stage skeleton to 4:3 frame is a large perceived jump (cited: state table loading-metadata, Design Review row 2) | — |

## Resolution Annex
