# Tasks: 0002F-emulator-themes-controls — SF01 play-screen-themes

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 11 |
| Services | test, frontend |

## Requirements Coverage

- [ ] RF01 — Default console-inspired theme for each of the 12 systems
- [ ] RF02 — Play screen fits 390×844, 844×390, 1366×768 without scroll, keeps aspect ratio, reserves SF02 slots
- [ ] RF03 — Background and frame drawn on the page around the emulator
- [ ] RN01 — Theme comes from the console default in code; works with MongoDB down
- [ ] RN02 — Theme accepts only validated values (hex `#RRGGBB`, closed frame list, https image on exact allowlisted host)
- [ ] RN03 — Unknown system uses the neutral theme

## TDD

- [ ] T-TEST-01 Contract test T04 (RN01): every exact name and legacy alias keeps the same `EmulatorSystem` and core — `tests/emulator-cores.test.ts`
- [ ] T-TEST-02 Contract tests T01, T02, T03, T09–T16 (RF01, RN01, RN02, RN03): 13 valid themes, contrast ≥ 4.5:1, per-field fallback, host-attack rejection, neutral for unknown system — `tests/play-theme.test.ts`
- [ ] T-TEST-03 Contract tests T05–T08, T17 (RF02, RF03, RN01, RN03): no scroll at 3 viewports, SF02 slots, frame wraps iframe, theme with Mongo down, not-found and metadata-error with Retry — `e2e/play-screen.qa.spec.ts`

## Execution

- [ ] T01 Lock current system-to-core mapping before the refactor
  - Service: test
  - Files: `tests/emulator-cores.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/emulator-cores.test.ts` exits non-zero only because `resolveEmulatorSystem` is not exported yet (the `getCoreForSystem` table cases, written first, pass against current code)
- [ ] T02 Write play-theme unit contract tests T01–T03, T09–T16
  - Service: test
  - Files: `tests/play-theme.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/play-theme.test.ts` exits non-zero because `lib/play-theme.ts` does not exist yet
- [ ] T03 Write play-screen E2E spec for main and no-mongo
  - Service: test
  - Files: `e2e/play-screen.qa.spec.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: with `.next` deleted and ports 3001/3002 free, `npx playwright test e2e/play-screen.qa.spec.ts --project=main` fails on the missing `[data-frame]` element (red against the current 600px card). Spec rules from plan.md Task 6: `super-retro` from `mockGames` in both projects (no seed); `running` via `page.route('**/emulator.html*')` stub posting `{type:'EMULATOR_CANVAS_READY'}`; `failed` tests use `test.setTimeout(90_000)` with the real core chain; each capture records its design-state name in `test.info().annotations` and the test title
- [ ] T04 Extract resolveEmulatorSystem; getCoreForSystem delegates to it
  - Service: frontend
  - Files: `lib/emulator-cores.ts`
  - Deps: T01
  - Consumes: -
  - Produces: `resolveEmulatorSystem(system?: string|null): EmulatorSystem | null`
  - Verify: before the edit, GitNexus `impact` upstream on `getCoreForSystem` is recorded (no symbols in index → NOT VERIFIED plus the text-search callers); after it, `node --import tsx --test tests/emulator-cores.test.ts` exits 0
- [ ] T05 Create pure play-theme module with 13 themes and validation
  - Service: frontend
  - Files: `lib/play-theme.ts`
  - Deps: T02, T04
  - Consumes: `resolveEmulatorSystem(system?: string|null): EmulatorSystem | null` (T04)
  - Produces: `FRAME_STYLES: readonly ['nes','snes','n64','dmg','gbc','gba','sms','megadrive','gamegear','ps','arcade','neogeo','neutral']`, `type FrameStyle = (typeof FRAME_STYLES)[number]`, `ASPECT_RATIOS: readonly ['4/3','10/9','3/2']`, `type AspectRatio = (typeof ASPECT_RATIOS)[number]`, `type PlayTheme = { frame: FrameStyle; bg: string; accent: string; frameColor: string; ar: AspectRatio; radius: string; bgImage?: string }`, `DEFAULT_PLAY_THEMES: Record<EmulatorSystem, PlayTheme>`, `NEUTRAL_PLAY_THEME: PlayTheme`, `ALLOWED_IMAGE_HOSTS: readonly ['i.imgur.com','upload.wikimedia.org','raw.githubusercontent.com']`, `isHexColor(v: unknown): boolean`, `isFrameStyle(v: unknown): boolean`, `isAllowedImageUrl(v: unknown): boolean`, `contrastRatio(a: string, b: string): number`, `pickTextColor(bg: string): '#F4F4F5'|'#18181B'`, `validatePlayTheme(input: unknown, fallback: PlayTheme): PlayTheme`, `resolvePlayTheme(system?: string|null, override?: unknown): PlayTheme`, `playThemeCssVars(t: PlayTheme): Record<'--t-bg'|'--t-accent'|'--t-frame'|'--t-text'|'--t-muted'|'--t-ar'|'--t-radius', string>`
  - Verify: `node --import tsx --test tests/play-theme.test.ts` exits 0
- [ ] T06 Add onStatusChange to Emulator; drop status bar and 600px
  - Service: frontend
  - Files: `components/Emulator.tsx`
  - Deps: -
  - Consumes: -
  - Produces: `Emulator(props: { gameSlug: string; gameTitle: string; core: string; onStatusChange?: (state: 'booting'|'running'|'failed', attempt: number, total: number, core: string) => void }): JSX.Element`
  - Verify: before the edit, GitNexus `impact` upstream on `Emulator` is recorded (same NOT VERIFIED rule); after it, `npm run build` exits 0, `git diff components/Emulator.tsx` shows `getCoreCandidates`, `FALLBACK_TIMEOUT_MS`, `RETRY_DELAY_MS` and the attempt order unchanged, and `failed` is emitted only in the three exhausted branches (confirmed by E2E T08 at T10)
- [ ] T07 Create StatusStrip and PlayTopBar components
  - Service: frontend
  - Files: `components/StatusStrip.tsx`, `components/PlayTopBar.tsx`
  - Deps: -
  - Consumes: -
  - Produces: `type PlayScreenState = 'loading-metadata'|'not-found'|'metadata-error'|'booting'|'running'|'failed'`, `StatusStrip(props: { state: PlayScreenState; attempt?: number; total?: number; coreName?: string }): JSX.Element`, `PlayTopBar(props: { title: string; systemLabel?: string; children?: React.ReactNode }): JSX.Element`
  - Verify: `npm run build` exits 0
- [ ] T08 Create ThemedFrame and data-frame rules in globals.css
  - Service: frontend
  - Files: `components/ThemedFrame.tsx`, `app/globals.css`
  - Deps: T05, T07
  - Consumes: `type FrameStyle = (typeof FRAME_STYLES)[number]` (T05), `type PlayScreenState = 'loading-metadata'|'not-found'|'metadata-error'|'booting'|'running'|'failed'` (T07)
  - Produces: `ThemedFrame(props: { frameStyle: FrameStyle; state: PlayScreenState; onRetry?: () => void; onReload?: () => void; children?: React.ReactNode }): JSX.Element`
  - Verify: `npm run build` exits 0, and `app/globals.css` holds one `[data-frame="<id>"]` rule for each of the 13 `FRAME_STYLES` ids
- [ ] T09 Create PlayStage composing theme, frame, emulator, slots
  - Service: frontend
  - Files: `components/PlayStage.tsx`
  - Deps: T05, T06, T07, T08
  - Consumes: `resolvePlayTheme(system?: string|null, override?: unknown): PlayTheme` (T05), `playThemeCssVars(t: PlayTheme): Record<'--t-bg'|'--t-accent'|'--t-frame'|'--t-text'|'--t-muted'|'--t-ar'|'--t-radius', string>` (T05), `Emulator(props: { gameSlug: string; gameTitle: string; core: string; onStatusChange?: (state: 'booting'|'running'|'failed', attempt: number, total: number, core: string) => void }): JSX.Element` (T06), `StatusStrip(props: { state: PlayScreenState; attempt?: number; total?: number; coreName?: string }): JSX.Element` (T07), `PlayTopBar(props: { title: string; systemLabel?: string; children?: React.ReactNode }): JSX.Element` (T07), `ThemedFrame(props: { frameStyle: FrameStyle; state: PlayScreenState; onRetry?: () => void; onReload?: () => void; children?: React.ReactNode }): JSX.Element` (T08)
  - Produces: `type PlayGameMeta = { title: string; system?: string; console?: string }`, `type MetaState = 'loading'|'not-found'|'metadata-error'|'ok'`, `PlayStage(props: { slug: string; game: PlayGameMeta | null; metaState: MetaState; onRetry: () => void }): JSX.Element`
  - Verify: `npm run build` exits 0
- [ ] T10 Rewrite play page with metaState, Retry and PlayStage
  - Service: frontend
  - Files: `app/play/[slug]/page.tsx`
  - Deps: T03, T09
  - Consumes: `type PlayGameMeta = { title: string; system?: string; console?: string }` (T09), `type MetaState = 'loading'|'not-found'|'metadata-error'|'ok'` (T09), `PlayStage(props: { slug: string; game: PlayGameMeta | null; metaState: MetaState; onRetry: () => void }): JSX.Element` (T09)
  - Produces: -
  - Verify: `npm run build` exits 0; then delete `.next`, free ports 3001/3002, run `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; delete `.next` again and run `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`; both exit 0
- [ ] T11 Add the two new unit tests to the AGENTS.md test gate
  - Service: test
  - Files: `AGENTS.md`
  - Deps: T04, T05
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts` exits 0 in a shell without `R2_*` vars, and AGENTS.md `validation_gates.test` holds exactly that command

## Acceptance Checklist

- [ ] `DEFAULT_PLAY_THEMES` has one key per `EmulatorSystem` (12/12) and `validatePlayTheme(t, t)` deep-equals each theme (RF01)
- [ ] Theme values match the design.md Tokens JSON for the 12 systems and `neutral` (frame, bg, accent, frameColor, ar, radius) (RF01)
- [ ] `contrastRatio(text, bg)` and `contrastRatio(accent, bg)` are ≥ 4.5 for all 13 themes, with text from `pickTextColor(bg)` (RF01, RN02)
- [ ] `resolvePlayTheme('SNES')` and `resolvePlayTheme('Mega Drive / Genesis')` return `DEFAULT_PLAY_THEMES['SNES']` and `DEFAULT_PLAY_THEMES['Mega Drive / Genesis']`; `'Game Boy'` and `'Game Boy Color'` resolve to different frames (`dmg`, `gbc`) (RF01, RN01)
- [ ] `lib/play-theme.ts` imports no React, no `lib/mongo.ts`, no `lib/data.ts`; theme resolution reads no database (RN01)
- [ ] `resolveEmulatorSystem` holds the single ordered exact + legacy-alias table; `getCoreForSystem` returns `systemToCoreMap[resolved] ?? defaultEmulatorCore` with the same log lines, and every case in `tests/emulator-cores.test.ts` returns the same core as before (RN01)
- [ ] `resolvePlayTheme('NES', undefined)` returns `DEFAULT_PLAY_THEMES['NES']`; a valid override (`bg:'#101820'`, `frame:'gba'`, wikimedia `bgImage`) is kept over the default (RN01, RN02)
- [ ] `validatePlayTheme` replaces each invalid field (`'red'`, `'#FFF'`, `'#GGGGGG'`, `frame:'xbox'`, `ar:'16/9'`, `radius` outside `'12px'`/`'16px'`/`'24px'`, non-string) with the fallback field, and returns the whole fallback when text or accent is < 4.5:1 on bg (RN02)
- [ ] `isAllowedImageUrl` accepts only `https:` URLs with no userinfo, no port in the raw authority (including `:443`), and a lowercase hostname equal to an `ALLOWED_IMAGE_HOSTS` entry; `i.imgur.com.evil.com`, `x.i.imgur.com`, `http:`, `:8080`, `user:pass@`, `javascript:`, `''`, `42` return false (RN02)
- [ ] `resolvePlayTheme('Atari Jaguar')`, `(null)` and `('')` return `NEUTRAL_PLAY_THEME` with `frame: 'neutral'` (RN03)
- [ ] `Emulator` emits `booting` per core attempt, `running` on `EMULATOR_CANVAS_READY`, and `failed` only on the three exhausted-chain branches, never on an intermediate per-core timeout; the callback is held in a ref so the effect deps stay `[gameSlug, gameTitle, core]` (RF02)
- [ ] `Emulator` no longer renders its own status `<div>` or `height: '600px'`; root is `h-full w-full`, iframe `w-full h-full` with `title="Play {gameTitle}"` and `allow="fullscreen"` kept (RF02)
- [ ] `PlayStage` root is `100dvh` (with `100vh` declared before it), overflow hidden, column layout; the frame takes `flex-1 min-h-0` and `aspect-ratio: var(--t-ar)` (RF02)
- [ ] `/play/super-retro` at 390×844, 844×390 and 1366×768 has `scrollHeight <= innerHeight` and a frame box ratio within ±2% of `--t-ar` (RF02)
- [ ] Empty SF02 mount points render with `data-slot="fullscreen"` (44×44 cell in `PlayTopBar`), `data-slot="touch-overlay"` (`absolute inset-0` over the stage below the top bar, visible only on `pointer: coarse`) and `data-slot="legend"` (40px row, visible only on `pointer: fine`); the overlay does not change the frame box (RF02)
- [ ] Theme is applied through inline `style` from `playThemeCssVars` and a `data-frame` attribute; no Tailwind class is built from a theme string (RF03)
- [ ] `app/globals.css` has a `@layer components` base `[data-frame]` rule (1px `--t-accent` border, `--t-radius`, `clamp(8px, 1.5vmin, 20px)` padding, `--t-frame` background, `aspect-ratio: var(--t-ar)`), one rule per 13 frame ids with no text content, and a `prefers-reduced-motion: reduce` block that disables frame transitions (RF03)
- [ ] On `/play/super-retro` the root computed `background-color` equals the arcade `bg`, the iframe is a descendant of `[data-frame="arcade"]`, and the iframe `src` carries no theme value (RF03)
- [ ] With the `no-mongo` project, `/play/super-retro` renders `[data-frame="arcade"]`, reaches `failed`, and Reload remounts the `Emulator` through `bootKey` without a page reload (RN01)
- [ ] `app/play/[slug]/page.tsx` maps `/api/game/{slug}` 200→`ok`, 404→`not-found`, network or other status→`metadata-error`; Retry increments `retryCount` and refetches only the metadata; the `max-w-5xl` card is gone (RF02, RN03)
- [ ] `/play/nope` shows `data-frame="neutral"`, "Game not found" and Back home with no emulator boot; aborted `/api/game/**` shows `data-frame="neutral"`, a `role="alert"` panel and a Retry that refetches (RN03)
- [ ] `StatusStrip` has `role="status"`, shows "Starting game (attempt {n} of {total})..." in booting with the core name only in visually hidden text, and "Running" in `text-xs` `--t-muted` in running (RF02)
- [ ] Back home, Retry, Reload and the fullscreen slot are ≥ 44px with 8px gap; Back home is first in focus order (RF02)
- [ ] No file changed under `lib/mongo.ts`, `lib/admin-login.ts`, `lib/login-throttle.ts`, `lib/auth-guard.ts`, `auth.ts`, `auth.config.ts`, `middleware.ts`, `app/api/auth/**`, `app/api/admin/**`, `models/**`; `/api/game` and `/api/rom` unchanged (RN01)
- [ ] AGENTS.md `validation_gates.test` runs `tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts` (RF01, RN02)

## Validation Gates

- [ ] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` and fix failures in files touched by this work
- [ ] Run `npm run build` and fix failures
- [ ] Before each commit, run `node .gitnexus/run.cjs detect-changes --scope all --repo .`; a `partial`/`truncated` result or an index with no symbols is recorded as NOT VERIFIED with the `git diff --name-only` list
