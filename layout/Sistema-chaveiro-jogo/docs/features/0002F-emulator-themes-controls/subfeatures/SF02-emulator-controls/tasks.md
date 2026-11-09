# Tasks: 0002F-emulator-themes-controls — SF02 emulator-controls

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 12 |
| Services | test, frontend, infra |

## Requirements Coverage

- [ ] RF01 — Each of the 12 systems has a default keyboard map with the original console's buttons
- [ ] RF02 — Fine pointer (PC): legend with the key of each button of the current console; touch: no legend
- [ ] RF03 — A connected USB/Bluetooth gamepad works with the console's default map, no setup
- [ ] RF04 — Player remaps keys in the browser; map saved only on that device; button to restore the default
- [ ] RF05 — Phone: virtual controller with the current console's buttons, visible on all 12 systems, fullscreen button, rotate hint in portrait
- [ ] RF06 — Controls module exports the default maps and the map-format validation; SF03 reuses the validation
- [ ] RN01 — Master System and Game Gear use their own 2-button scheme, not the Mega Drive one
- [ ] RN02 — Map = object `{console button: key code}` from closed lists; emulator receives the validated object by `postMessage`, never free text; console id picks the default only when no resolved map exists
- [ ] RN03 — Page ↔ emulator messages check the sender origin and window
- [ ] RN04 — Remap in a RetroKey panel, per console, saved in `localStorage`; player map beats resolved map (admin or default); "reset" deletes the saved map and returns to the resolved one

## TDD

- [ ] T-TEST-01 Contract tests T01–T19 and T47 (RF01, RF02, RF03, RF04, RF06, RN01, RN02, RN03, RN04), plus T20 only when the ledger records `INPUT_PATH=boot` — `tests/emulator-controls.test.ts`
- [ ] T-TEST-02 Contract tests T21–T26, T28–T39 and T48 (RF01, RF02, RF03, RF04, RN01, RN02, RN03, RN04): legend, map delivery, fake loader, trusted messages, Keys panel — `e2e/play-screen.qa.spec.ts`
- [ ] T-TEST-03 Contract tests T40–T46, T49, T50 (RF02, RF05): virtual controller, Controller fit, layout stability, touch input, rotate hint, fullscreen, a11y — `e2e/play-screen.qa.spec.ts`
- [ ] T-TEST-04 Manual T27 (RF03): one physical pad on the spike page with the spike ROM — `docs/features/0002F-emulator-themes-controls/subfeatures/SF02-emulator-controls/build-ledger.md` (`## Spike`, row S6)

## Execution

- [ ] T01 Run EmulatorJS input spike S1–S8 with one owner ROM
  - Service: test
  - Files: `docs/features/0002F-emulator-themes-controls/subfeatures/SF02-emulator-controls/build-ledger.md`
  - Deps: -
  - Consumes: -
  - Produces: `INPUT_PATH=listener|boot` (build-ledger.md `## Spike`)
  - Verify: owner copies 1 Master System or Game Gear ROM into `public/roms/` and a hand-edited copy of `public/emulator.html` to `public/roms/emulator-spike.html`, opens `http://localhost:3001/roms/emulator-spike.html?core=<core>&rom=/roms/<file>&title=Spike` (no `/play`, no Mongo, `.env.local` not opened); `build-ledger.md` holds `## Spike` with one row per S1–S8 (answer, EJS version, core, ROM console, decision) and the `INPUT_PATH` line; `public/roms/emulator-spike.html` stays (gitignored) until T11; `git check-ignore public/roms/<file>` prints the path and `git status --porcelain public/roms` is empty. S1 negative → stop the build and return to the owner
- [ ] T02 Write controls module unit tests T01–T19, T47 (red)
  - Service: test
  - Files: `tests/emulator-controls.test.ts`
  - Deps: T01
  - Consumes: `INPUT_PATH=listener|boot` (build-ledger.md `## Spike`) (T01)
  - Produces: -
  - Verify: in a shell without any `R2_*` variable, `node --import tsx --test tests/emulator-controls.test.ts` exits non-zero only because `lib/emulator-controls.ts` does not exist yet; the file imports only `lib/emulator-controls.ts` and `lib/bezel-console.ts` and reads `public/emulator.html` as text for T19; T20 is written only when the ledger records `INPUT_PATH=boot`
- [ ] T03 Create pure controls module with the exact exports
  - Service: frontend
  - Files: `lib/emulator-controls.ts`
  - Deps: T01, T02
  - Consumes: -
  - Produces: `EJS_INDEX = { B:0, Y:1, SELECT:2, START:3, UP:4, DOWN:5, LEFT:6, RIGHT:7, A:8, X:9, L:10, R:11, L2:12, R2:13, L3:14, R3:15, LSTICK_RIGHT:16, LSTICK_LEFT:17, LSTICK_DOWN:18, LSTICK_UP:19, RSTICK_RIGHT:20, RSTICK_LEFT:21, RSTICK_DOWN:22, RSTICK_UP:23 } as const`, `type EjsIndex = (typeof EJS_INDEX)[keyof typeof EJS_INDEX]`, `ANALOG_INDICES: readonly EjsIndex[]`, `ANALOG_MAX = 0x7fff`, `type ConsoleButton = (typeof CONSOLE_BUTTONS)[number]`, `BUTTONS_BY_CONSOLE: Record<BezelConsoleId, readonly ConsoleButton[]>`, `buttonLabel(consoleId: BezelConsoleId, button: ConsoleButton): string`, `type ButtonGroup = { label: string; buttons: readonly ConsoleButton[] }`, `legendGroups(consoleId: BezelConsoleId): readonly ButtonGroup[]`, `BUTTON_INDEX: Record<BezelConsoleId, Partial<Record<ConsoleButton, EjsIndex>>>`, `buttonIndex(consoleId: BezelConsoleId, button: ConsoleButton): EjsIndex | null`, `type KeyCode = (typeof KEY_CODES)[number]`, `isKeyCode(value: unknown): value is KeyCode`, `keyCapLabel(code: KeyCode): string`, `type ControlMap = Readonly<Partial<Record<ConsoleButton, KeyCode>>>`, `DEFAULT_CONTROL_MAPS: Record<BezelConsoleId, ControlMap>`, `type EjsControlScheme = 'nes' | 'snes' | 'n64' | 'gb' | 'gba' | 'segaMS' | 'segaGG' | 'segaMD' | 'psx' | 'arcade'`, `CONSOLE_SCHEMES: Record<BezelConsoleId, EjsControlScheme>`, `GAMEPAD_LABELS: Readonly<Record<EjsIndex, string>>`, `type ControlMapError = 'not-object' | 'unknown-button' | 'missing-button' | 'invalid-code' | 'duplicate-code'`, `type ControlMapResult = { ok: true; map: ControlMap } | { ok: false; error: ControlMapError; button?: ConsoleButton }`, `validateControlMap(input: unknown, consoleId: BezelConsoleId): ControlMapResult`, `resolveControlMap(saved: unknown, adminMap: unknown, consoleId: BezelConsoleId): { map: ControlMap; source: 'player' | 'admin' | 'default' }`, `applyRemap(map: ControlMap, consoleId: BezelConsoleId, button: ConsoleButton, code: KeyCode): { map: ControlMap; swappedWith: ConsoleButton | null }`, `CONTROLS_STORAGE_PREFIX = 'retrokey:controls:v1:'`, `controlsStorageKey(consoleId: BezelConsoleId): string`, `parseSavedControlMap(raw: string | null, consoleId: BezelConsoleId): ControlMap | null`, `serializeControlMap(map: ControlMap): string`, `type RkControlsMessage = { type: 'RK_CONTROLS'; console: BezelConsoleId; bindings: ReadonlyArray<readonly [KeyCode, EjsIndex]> }`, `type RkInputMessage = { type: 'RK_INPUT'; index: EjsIndex; pressed: boolean }`, `type RkReleaseAllMessage = { type: 'RK_RELEASE_ALL' }`, `type PageToEmulatorMessage = RkControlsMessage | RkInputMessage | RkReleaseAllMessage`, `type EmulatorToPageMessage = { type: 'EMULATOR_CANVAS_READY' }`, `toControlsMessage(map: ControlMap, consoleId: BezelConsoleId): RkControlsMessage`, `inputMessage(consoleId: BezelConsoleId, button: ConsoleButton, pressed: boolean): RkInputMessage | null`, `parsePageMessage(data: unknown, consoleId: BezelConsoleId): PageToEmulatorMessage | null`, `parseEmulatorMessage(data: unknown): EmulatorToPageMessage | null`, `isTrustedMessage(event: { origin: string; source: unknown }, expectedOrigin: string, expectedSource: unknown): boolean`, `consoleIdForSystem(system?: string | null): BezelConsoleId | null`, and only under `INPUT_PATH=boot`: `EJS_KEY_NAMES: Readonly<Record<KeyCode, string>>`
  - Verify: in a shell without `R2_*`, `node --import tsx --test tests/emulator-controls.test.ts` exits non-zero only on T19 `lib-RF06-emulator-html-contract-block` (T01–T18 and T47 green; T20 green when present); the module imports only `lib/bezel-console.ts`, `lib/play-theme.ts` and `lib/emulator-cores.ts` and has no `react`, `fs` or DOM import; `git diff lib/bezel-console.ts` is empty
- [ ] T04 Rewrite emulator.html boot, listener and trusted messaging
  - Service: frontend
  - Files: `public/emulator.html`
  - Deps: T01, T03
  - Consumes: `CONSOLE_SCHEMES: Record<BezelConsoleId, EjsControlScheme>` (T03), `GAMEPAD_LABELS: Readonly<Record<EjsIndex, string>>` (T03), `ANALOG_INDICES: readonly EjsIndex[]` (T03), `ANALOG_MAX = 0x7fff` (T03), `parsePageMessage(data: unknown, consoleId: BezelConsoleId): PageToEmulatorMessage | null` (T03), `INPUT_PATH=listener|boot` (build-ledger.md `## Spike`) (T01)
  - Produces: `/emulator.html?title=<title>&core=<core>&rom=<rom>&console=<BezelConsoleId>`, `<script type="application/json" id="rk-controls-contract">{"consoles","schemes","keyCodes","gamepad","analog"}</script>`, `window.parent.postMessage({ type: 'EMULATOR_CANVAS_READY' }, location.origin)`, `window.EJS_emulator.gameManager.simulateInput(0, index, value)`
  - Verify: before the edit, run GitNexus `impact` upstream on the symbols that load `/emulator.html` (`Emulator`) with the root index and run a text search for `emulator.html`; record both in the SF02 `build-ledger.md` (`UNKNOWN` → the text search is the caller list); after the edit, `node --import tsx --test tests/emulator-controls.test.ts` exits 0 (T19 green) in a shell without `R2_*`, a text search of `public/emulator.html` finds no `postMessage(` with `'*'` and no per-core `if` branches, and `npm run build` exits 0
- [ ] T05 Add EmulatorHandle, console param, trusted messages, useControlMap
  - Service: frontend
  - Files: `components/Emulator.tsx`, `components/useControlMap.ts`
  - Deps: T03, T04
  - Consumes: `isTrustedMessage(event: { origin: string; source: unknown }, expectedOrigin: string, expectedSource: unknown): boolean` (T03), `parseEmulatorMessage(data: unknown): EmulatorToPageMessage | null` (T03), `type RkControlsMessage = { type: 'RK_CONTROLS'; console: BezelConsoleId; bindings: ReadonlyArray<readonly [KeyCode, EjsIndex]> }` (T03), `type RkInputMessage = { type: 'RK_INPUT'; index: EjsIndex; pressed: boolean }` (T03), `type RkReleaseAllMessage = { type: 'RK_RELEASE_ALL' }` (T03), `type EjsIndex = (typeof EJS_INDEX)[keyof typeof EJS_INDEX]` (T03), `type ControlMap = Readonly<Partial<Record<ConsoleButton, KeyCode>>>` (T03), `DEFAULT_CONTROL_MAPS: Record<BezelConsoleId, ControlMap>` (T03), `resolveControlMap(saved: unknown, adminMap: unknown, consoleId: BezelConsoleId): { map: ControlMap; source: 'player' | 'admin' | 'default' }` (T03), `applyRemap(map: ControlMap, consoleId: BezelConsoleId, button: ConsoleButton, code: KeyCode): { map: ControlMap; swappedWith: ConsoleButton | null }` (T03), `controlsStorageKey(consoleId: BezelConsoleId): string` (T03), `parseSavedControlMap(raw: string | null, consoleId: BezelConsoleId): ControlMap | null` (T03), `serializeControlMap(map: ControlMap): string` (T03), `/emulator.html?title=<title>&core=<core>&rom=<rom>&console=<BezelConsoleId>` (T04), `window.parent.postMessage({ type: 'EMULATOR_CANVAS_READY' }, location.origin)` (T04)
  - Produces: `type EmulatorHandle = { sendInput: (index: EjsIndex, pressed: boolean) => void; releaseAll: () => void; focusGame: () => boolean }`, `EmulatorProps.consoleId?: BezelConsoleId | null`, `EmulatorProps.controls?: RkControlsMessage | null`, `export default forwardRef<EmulatorHandle, EmulatorProps>(function Emulator(...))`, `type ControlMapState = { map: ControlMap | null; hasSaved: boolean; storageOk: boolean; remap: (button: ConsoleButton, code: KeyCode) => void; reset: () => void }`, `useControlMap(consoleId: BezelConsoleId | null): ControlMapState`
  - Verify: before editing `components/Emulator.tsx`, run GitNexus `impact` upstream on `Emulator` with the root index and record it in the SF02 `build-ledger.md`; the result is `UNKNOWN` (JSX not indexed), so confirm callers by text search for `Emulator` imports and record them; after, `npm run build` exits 0, `EmulatorStatus` is unchanged and a text search of `components/Emulator.tsx` finds no `postMessage(` with `'*'`
- [ ] T06 Create ControlsLegend and KeysPanel components
  - Service: frontend
  - Files: `components/ControlsLegend.tsx`, `components/KeysPanel.tsx`
  - Deps: T03
  - Consumes: `legendGroups(consoleId: BezelConsoleId): readonly ButtonGroup[]` (T03), `buttonLabel(consoleId: BezelConsoleId, button: ConsoleButton): string` (T03), `keyCapLabel(code: KeyCode): string` (T03), `isKeyCode(value: unknown): value is KeyCode` (T03), `BUTTONS_BY_CONSOLE: Record<BezelConsoleId, readonly ConsoleButton[]>` (T03), `type ControlMap = Readonly<Partial<Record<ConsoleButton, KeyCode>>>` (T03)
  - Produces: `interface ControlsLegendProps { consoleId: BezelConsoleId | null; map: ControlMap | null; status: PlayScreenState; onEdit: () => void; editButtonRef: RefObject<HTMLButtonElement> }`, `export default function ControlsLegend(props: ControlsLegendProps)`, `interface KeysPanelProps { consoleId: BezelConsoleId; map: ControlMap; hasSaved: boolean; storageOk: boolean; open: boolean; onRemap: (button: ConsoleButton, code: KeyCode) => void; onReset: () => void; onClose: () => void }`, `export default function KeysPanel(props: KeysPanelProps)`
  - Verify: `npm run build` exits 0
- [ ] T07 Create VirtualController, RotateHint and FullscreenToggle components
  - Service: frontend
  - Files: `components/VirtualController.tsx`, `components/RotateHint.tsx`, `components/FullscreenToggle.tsx`
  - Deps: T03
  - Consumes: `BUTTONS_BY_CONSOLE: Record<BezelConsoleId, readonly ConsoleButton[]>` (T03), `buttonLabel(consoleId: BezelConsoleId, button: ConsoleButton): string` (T03)
  - Produces: `interface VirtualControllerProps { consoleId: BezelConsoleId; status: PlayScreenState; onInput: (button: ConsoleButton, pressed: boolean) => void }`, `export default function VirtualController(props: VirtualControllerProps)`, `[data-button=<ConsoleButton>]`, `interface RotateHintProps { onDismiss: () => void }`, `export default function RotateHint(props: RotateHintProps)`, `sessionStorage['retrokey:rotate-hint-dismissed']`, `interface FullscreenToggleProps { targetRef: RefObject<HTMLElement> }`, `export default function FullscreenToggle(props: FullscreenToggleProps)`
  - Verify: `npm run build` exits 0
- [ ] T08 Mount SF02 components in PlayStage slots
  - Service: frontend
  - Files: `components/PlayStage.tsx`
  - Deps: T05, T06, T07
  - Consumes: `useControlMap(consoleId: BezelConsoleId | null): ControlMapState` (T05), `type EmulatorHandle = { sendInput: (index: EjsIndex, pressed: boolean) => void; releaseAll: () => void; focusGame: () => boolean }` (T05), `EmulatorProps.consoleId?: BezelConsoleId | null` (T05), `EmulatorProps.controls?: RkControlsMessage | null` (T05), `export default function ControlsLegend(props: ControlsLegendProps)` (T06), `export default function KeysPanel(props: KeysPanelProps)` (T06), `export default function VirtualController(props: VirtualControllerProps)` (T07), `export default function FullscreenToggle(props: FullscreenToggleProps)` (T07), `toControlsMessage(map: ControlMap, consoleId: BezelConsoleId): RkControlsMessage` (T03), `buttonIndex(consoleId: BezelConsoleId, button: ConsoleButton): EjsIndex | null` (T03), `consoleIdForSystem(system?: string | null): BezelConsoleId | null` (T03)
  - Produces: `[data-slot="legend"]`, `[data-slot="touch-overlay"]`, `[data-slot="fullscreen"] button[aria-pressed]`, `[data-testid="play-stage"]`
  - Verify: before editing, run GitNexus `impact` upstream on `PlayStage` with the root index and record it; `UNKNOWN` → confirm callers by text search and record them; after, `npm run build` exits 0 and `git diff components/PlayTopBar.tsx components/ThemedFrame.tsx components/StatusStrip.tsx app/globals.css` is empty
- [ ] T09 Write E2E for legend, map, fake loader, Keys panel
  - Service: test
  - Files: `e2e/play-screen.qa.spec.ts`
  - Deps: T04, T08
  - Consumes: `/emulator.html?title=<title>&core=<core>&rom=<rom>&console=<BezelConsoleId>` (T04), `window.parent.postMessage({ type: 'EMULATOR_CANVAS_READY' }, location.origin)` (T04), `window.EJS_emulator.gameManager.simulateInput(0, index, value)` (T04), `<script type="application/json" id="rk-controls-contract">{"consoles","schemes","keyCodes","gamepad","analog"}</script>` (T04), `[data-slot="legend"]` (T08), `toControlsMessage(map: ControlMap, consoleId: BezelConsoleId): RkControlsMessage` (T03), `DEFAULT_CONTROL_MAPS: Record<BezelConsoleId, ControlMap>` (T03), `GAMEPAD_LABELS: Readonly<Record<EjsIndex, string>>` (T03), `legendGroups(consoleId: BezelConsoleId): readonly ButtonGroup[]` (T03), `buttonIndex(consoleId: BezelConsoleId, button: ConsoleButton): EjsIndex | null` (T03)
  - Produces: `stubEmulatorRecorder(page: Page): Promise<void>`, `received(page: Page): Promise<{ messages: Array<{ data: unknown; origin: string; fromParent: boolean }>; keys: string[] }>`, `routeFakeEjsLoader(page: Page): Promise<void>`
  - Verify: existing `stubEmulatorReady`/`stubEmulatorHeld` post with `location.origin`; every Wide test calls `routeBezel(page, 'missing')`; data only through `page.route`; titles carry `SF02-`; then, in a shell without `R2_*`, delete `.next`, free ports 3001/3002 and with `MONGODB_DB=retrokey_e2e` run `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; delete `.next` again and run `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`; both exit 0 (T21–T26, T28–T39 and T48 green, SF01 and SF04 tests in the file still green)
- [ ] T10 Write E2E for touch controller, hint, fullscreen, a11y
  - Service: test
  - Files: `e2e/play-screen.qa.spec.ts`
  - Deps: T08, T09
  - Consumes: `stubEmulatorRecorder(page: Page): Promise<void>` (T09), `received(page: Page): Promise<{ messages: Array<{ data: unknown; origin: string; fromParent: boolean }>; keys: string[] }>` (T09), `[data-button=<ConsoleButton>]` (T07), `sessionStorage['retrokey:rotate-hint-dismissed']` (T07), `[data-slot="legend"]` (T08), `[data-slot="touch-overlay"]` (T08), `[data-slot="fullscreen"] button[aria-pressed]` (T08), `[data-testid="play-stage"]` (T08), `BUTTONS_BY_CONSOLE: Record<BezelConsoleId, readonly ConsoleButton[]>` (T03), `buttonLabel(consoleId: BezelConsoleId, button: ConsoleButton): string` (T03), `buttonIndex(consoleId: BezelConsoleId, button: ConsoleButton): EjsIndex | null` (T03)
  - Produces: -
  - Verify: in a shell without `R2_*`, delete `.next`, free ports 3001/3002 and with `MONGODB_DB=retrokey_e2e` run `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; delete `.next` again and run `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`; both exit 0 (T40–T46, T49 legend empty and controller hidden in not-found/failed, T50 768×1024 fine with no legend and no controller; SF01 and SF04 tests still green)
- [ ] T11 Record manual physical-pad check T27 in ledger
  - Service: test
  - Files: `docs/features/0002F-emulator-themes-controls/subfeatures/SF02-emulator-controls/build-ledger.md`
  - Deps: T01, T08
  - Consumes: `INPUT_PATH=listener|boot` (build-ledger.md `## Spike`) (T01)
  - Produces: -
  - Verify: owner plugs 1 USB/Bluetooth pad and opens the spike page `public/roms/emulator-spike.html` with the spike ROM (dev server on port 3001, shell with `MONGODB_DB=retrokey_e2e`, no `R2_*`; `/play/<slug>` is not used because no game with a real ROM exists in `retrokey_e2e`); south button, D-pad, Start and shoulders move the game with no setup; `build-ledger.md` `## Spike` row S6 holds answer, EJS version, core and console; then `public/roms/emulator-spike.html` is deleted and `git status --porcelain public/roms` is empty
- [ ] T12 Add emulator-controls test to the AGENTS.md test gate
  - Service: infra
  - Files: `AGENTS.md`
  - Deps: T04
  - Consumes: -
  - Produces: -
  - Verify: in a shell without `R2_*` vars, `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts tests/emulator-controls.test.ts` exits 0, and AGENTS.md `validation_gates.test` holds exactly that command

## Acceptance Checklist

- [ ] `lib/emulator-controls.ts` imports only `BezelConsoleId`/`BEZEL_CONSOLE_IDS` from `lib/bezel-console.ts`, `DEFAULT_PLAY_THEMES` from `lib/play-theme.ts` and `resolveEmulatorSystem` from `lib/emulator-cores.ts`, has no `react`, `fs` or DOM import, and imports in node:test with no `window`/`document`; `validateControlMap`, `DEFAULT_CONTROL_MAPS`, `BUTTONS_BY_CONSOLE`, `KEY_CODES`, `isKeyCode` and `resolveControlMap` are exported for SF03 (RF06)
- [ ] `DEFAULT_CONTROL_MAPS` has exactly the 12 `BEZEL_CONSOLE_IDS` keys; each map's keys equal `BUTTONS_BY_CONSOLE[id]` and pass `validateControlMap` (12/12) (RF01)
- [ ] Default keys follow plan.md OQ-3: directions `Arrow*`, `select→Space`, `start→Enter`, `b→KeyZ`/`a→KeyX` on NES/GB/GBC, SNES `y→KeyA x→KeyS l→KeyQ r→KeyW`, N64 D-pad on `KeyI/KeyK/KeyJ/KeyL`, C on `KeyT/KeyG/KeyF/KeyH`, Arcade/Neo Geo `coin→Digit5` (RF01)
- [ ] `BUTTON_INDEX` has an entry in 0..23 for every button of `BUTTONS_BY_CONSOLE[id]`; `buttonIndex('nes','c')` returns `null`; `toControlsMessage(default, id).bindings.length` equals the console's button count (RF01)
- [ ] `BUTTONS_BY_CONSOLE.sms` and `.gamegear` are exactly `up,down,left,right,1,2,start` (no `a`/`b`/`c`); `CONSOLE_SCHEMES` gives `segaMS`/`segaGG` for them and `segaMD` only for `megadrive`; `1→0`, `2→8`; defaults `1→KeyZ`, `2→KeyX`; a Mega Drive map validated as `sms` returns `unknown-button` (RN01)
- [ ] `legendGroups` collapses D-pad, Stick and each of the four C into one group (n64 = 9 groups, ps = 11); `buttonLabel('sms','start')` = `Pause`; `keyCapLabel` maps `KeyX`→`X`, `Digit5`→`5`, `ArrowUp`→`↑`, `Enter`, `Space` (RF02)
- [ ] `GAMEPAD_LABELS` has 24 entries (0 `BUTTON_2`, 8 `BUTTON_1`, 4–7 `DPAD_*`, 10–13 shoulders, 16–19 `LEFT_STICK_*`); `ANALOG_INDICES` = 16..23; `ANALOG_MAX` = `0x7fff` (RF03)
- [ ] `KEY_CODES` excludes `Tab`, `Escape`, `F1`–`F12`, Shift/Control/Alt/Meta (L/R), `CapsLock`, `ContextMenu`; `isKeyCode` is exact and case-sensitive (RN02)
- [ ] `validateControlMap` accepts only plain objects (prototype `Object.prototype` or `null`), own keys only, and returns a fresh frozen copy; it returns `not-object`, `unknown-button`, `missing-button`, `invalid-code` and `duplicate-code` for the T11 inputs (RN02)
- [ ] `parsePageMessage` and `parseEmulatorMessage` return `null` for every T13 malformed input (string data, extra key, wrong console, index 24/-1/1.5/'8', `Tab`, 25 bindings, repeated code, 3-tuple, string `pressed`, unknown type); `inputMessage('nes','c',true)` returns `null` (RN02)
- [ ] `resolveControlMap` returns the first valid of player > admin > `DEFAULT_CONTROL_MAPS[id]`; a valid saved map wins over the console default; SF02 passes `adminMap = undefined` (RN02, RN04)
- [ ] `applyRemap` swaps when the code is held by another button (`swappedWith` set), the result always validates and the input map is unchanged (RF04)
- [ ] `controlsStorageKey('nes')` = `retrokey:controls:v1:nes`; `parseSavedControlMap` returns `null` for `null`, `'{'`, `'[]'`, `'"x"'`, another console's map and a `Tab` value, and never throws (RF04, RN04)
- [ ] `isTrustedMessage` is true only when `expectedSource != null`, `event.source === expectedSource` and `event.origin === expectedOrigin`; false for `https://evil.example`, `'null'`, origin with trailing `/`, another source and a null expected source (RN03)
- [ ] `consoleIdForSystem` maps a game's system (exact or legacy alias) to its console id from `DEFAULT_PLAY_THEMES`, returns `null` for unknown/empty, and `PlayStage` derives `consoleId` from it, never from `theme.frame` (T47) (RF06, RN02)
- [ ] With no valid `console` param, `emulator.html` writes no `EJS_defaultControls` and leaves the built-in virtual gamepad on; with `simulateInput` missing, bound keys are not `defaultPrevented`, `RK_INPUT` is dropped and one `[rk] input API missing` warn is logged (T29, T48) (RF01, RF05)
- [ ] `public/emulator.html` carries `#rk-controls-contract` whose `consoles`, `schemes`, `keyCodes`, `gamepad` and `analog` deep-equal `BEZEL_CONSOLE_IDS`, `CONSOLE_SCHEMES`, `KEY_CODES`, `GAMEPAD_LABELS` and `ANALOG_INDICES` (T19) (RF06, RN02)
- [ ] `public/emulator.html` reads the `console` URL param allowlisted to the 12 ids; any other value or no param sets no `EJS_controlScheme` and no bindings (`KeyZ` → 0 `simulateInput` calls); the per-core `if` branches are removed (RN01, RN02)
- [ ] Before `loader.js`, every `EJS_defaultControls[0][i]` for i 0..23 has `value: ''` (or `EJS_KEY_NAMES` under `INPUT_PATH=boot`) and `value2: GAMEPAD_LABELS[i]`; the built-in EmulatorJS virtual gamepad is off by the S7 option; `keyboardInput`/`altKeyboardInput = 'disabled'` is kept (RF03, RF05)
- [ ] The iframe listener handles `keydown` (ignoring `event.repeat`) and `keyup` on `window` in capture phase: bound code → `simulateInput(0, index, 1 or 0x7fff for analog)` then `0`, with `preventDefault()`; unbound keys pass through; `RK_INPUT` uses the same call; `RK_RELEASE_ALL` and `blur` release every pressed index; missing `simulateInput` is a no-op (RF01, RF05)
- [ ] The iframe drops any message unless `event.origin === location.origin && event.source === window.parent`, re-checks the shape inline like `parsePageMessage`, ignores invalid data with one `console.warn` carrying only the type, and never writes a received string to the DOM (RN02, RN03)
- [ ] Both directions post with target `location.origin`; no `postMessage` with `'*'` remains in `public/emulator.html`, `components/Emulator.tsx` or the E2E stubs (RN03)
- [ ] `Emulator` is `forwardRef<EmulatorHandle, EmulatorProps>`; the iframe URL gains `console` only when `consoleId` is non-null; the listener runs `isTrustedMessage(event, location.origin, iframeRef.current?.contentWindow)` before `parseEmulatorMessage`; one `RK_CONTROLS` object is posted on every trusted `EMULATOR_CANVAS_READY` (2 after Reload) and again on `controls` change while running; `EmulatorStatus` is unchanged (RF01, RN02, RN03)
- [ ] `useControlMap` renders `DEFAULT_CONTROL_MAPS[id]` first (SSR-safe), reads storage in an effect on `[consoleId]`, `remap` = `applyRemap` + `setItem`, `reset` = `removeItem` + resolved map, and sets `storageOk=false` with the map kept in state when any storage call throws (RF04, RN04)
- [ ] `ControlsLegend` renders in `[data-slot="legend"]` (class `hidden h-10 shrink-0 wide:block` unchanged) one chip per group as `label [keycap]`, chip text 12px; Edit keys is `aria-disabled` in booting and enabled in running; the row is empty outside booting/running (RF02)
- [ ] At 1024×768 and 1366×768 fine, for 12 consoles, the legend row has `scrollWidth ≤ clientWidth`, every chip is inside the row and Edit keys is 40px high × ≥44px wide; at 390×844, 844×390 and 1366×768 touch and at 768×1024 fine the legend and Edit keys are hidden (RF02)
- [ ] `KeysPanel` is a native `<dialog>` opened with `showModal()`; capture shows "Press a key for A. Esc cancels."; a non-`KeyCode` key shows "That key can't be used. Pick another." and keeps capturing; `Escape` in capture fires `cancel` with `preventDefault` and returns to idle with the dialog open; a held code shows "Z was on B; swapped."; Reset is disabled with no saved map (RF04, RN04)
- [ ] A remap updates the legend, sends a new `RK_CONTROLS`, writes `localStorage['retrokey:controls:v1:<id>']` and survives `page.reload()`; Reset shows "Default keys restored.", removes the key and sends the default map; a junk or other-console saved value is ignored and the default is shown and sent (RF04, RN04)
- [ ] With `localStorage.setItem` throwing, the panel shows "Keys can't be saved in this browser.", the new map applies for the session and the default returns after reload (RF04)
- [ ] Opening the panel calls `releaseAll()`; after Done with Enter, focus moves to the play iframe only after the `keyup` (fallback Edit keys), the recorder has no `Enter` keydown, and the `[data-window]` box moves 0px before, during and after the panel (RF04)
- [ ] `VirtualController` mounts in `[data-slot="touch-overlay"]` when `consoleId !== null`, is hidden outside booting/running, renders `[data-button]` per `BUTTONS_BY_CONSOLE[id]` (N64 per D-pad/Stick toggle) with `aria-label = buttonLabel(...)` and ≥44×44 boxes; booting is `aria-disabled` with 0 `RK_INPUT`; running pointerdown/up posts `RK_INPUT` pressed `true` then `false` with `buttonIndex`; pointercancel, blur, visibilitychange and orientationchange release (RF05)
- [ ] Controller fit for 12 consoles: in 390×844 no button rect intersects `[data-window]` or the status strip; in 844×390 overlap with `[data-window]` is ≤24px; the `[data-window]` box is equal across booting, running, after Dismiss and with/without SF02 (RF05)
- [ ] `RotateHint` shows "Turn your phone sideways for a bigger game." in 390×844 and not in 844×390; Dismiss (≥44×44) hides it and `sessionStorage['retrokey:rotate-hint-dismissed']` keeps it hidden after reload in the same session (RF05)
- [ ] `FullscreenToggle` is passed as `PlayTopBar` children into `[data-slot="fullscreen"]`, targets `[data-testid="play-stage"]`, toggles `aria-pressed` and the label "Full screen"/"Exit full screen" on `fullscreenchange`, is ≥44×44, and renders nothing when `!document.fullscreenEnabled` (RF05)
- [ ] `git diff` of `components/PlayTopBar.tsx`, `components/ThemedFrame.tsx`, `components/StatusStrip.tsx` and `app/globals.css` is empty; window proportions and frame are unchanged (RF05)
- [ ] axe reports 0 violations for the legend running at 1366×768, the Keys panel in idle and capture (`aria-labelledby`, status `role="status"`, rows ≥44px) and the controller running at 390×844; touch buttons have `transition-duration` 0s (RF02, RF04, RF05)
- [ ] Fake-loader E2E on the real `emulator.html`: `EJS_controlScheme` is `nes`/`segaMS`/`segaGG`/`segaMD`/`n64` for those consoles, `value2` equals `GAMEPAD_LABELS` for all 12 consoles, `KeyZ` → `simulateInput(0, idx, 1)` then `0`, n64 `ArrowUp` → `(0,19,0x7fff)`, malformed `RK_CONTROLS` leave the map unchanged (RF01, RF03, RN01, RN02)
- [ ] A `EMULATOR_CANVAS_READY` posted by the page to itself keeps the status Starting game with no `RK_CONTROLS` sent, and a `RK_INPUT` the iframe posts to itself causes 0 `simulateInput` calls; every message the recorder receives has the app origin and `source === parent` (RN03)
- [ ] `build-ledger.md` `## Spike` has rows S1–S8 (answer, EJS version, core, ROM console, decision) and the `INPUT_PATH` value; `public/roms/emulator-spike.html` is deleted after T11 and no `public/roms/**` file is tracked by git (RF01, RF03, RF05)
- [ ] `EJS_KEY_NAMES` and T20 exist only when the ledger records `INPUT_PATH=boot`; under `INPUT_PATH=listener` neither is created (RF01)
- [ ] T27: `build-ledger.md` S6 records that 1 physical pad moves the game (south button, D-pad, Start, shoulders) on the spike page with no setup (RF03)
- [ ] GitNexus impact recorded with the root index before editing `public/emulator.html`, `Emulator` and `PlayStage`; each `UNKNOWN` result is followed by a recorded text search of callers (RF06, RN03)
- [ ] No file changed under `lib/mongo.ts`, `lib/admin-login.ts`, `lib/login-throttle.ts`, `lib/auth-guard.ts`, `lib/bezel-console.ts`, `auth.ts`, `auth.config.ts`, `middleware.ts`, `app/api/auth/**`, existing `app/api/admin/**` routes, `app/nfc/**`; `lib/r2.ts` unchanged; `package.json` has no new dependency (RF06, RN03)
- [ ] E2E uses data only through `page.route`, calls `routeBezel` in every Wide test, never sets `R2_*`, titles carry `SF02-`, and SF01/SF04 tests in `e2e/play-screen.qa.spec.ts` pass in `--project=main` and `--project=no-mongo` (RF02, RF05)
- [ ] AGENTS.md `validation_gates.test` runs `tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts tests/emulator-controls.test.ts` (RF06)

## Validation Gates

- [ ] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts` (in a shell without `R2_*` vars) and fix failures in files touched by this work
- [ ] Run `npm run build` and fix failures
- [ ] Before each commit, run `node .gitnexus/run.cjs detect-changes --scope all --repo .`; a `partial`/`truncated` result or an index with no symbols is recorded as NOT VERIFIED with the `git diff --name-only` list
