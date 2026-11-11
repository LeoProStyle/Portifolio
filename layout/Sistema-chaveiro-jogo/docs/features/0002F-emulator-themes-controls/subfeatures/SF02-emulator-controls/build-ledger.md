# Build ledger: 0002F SF02 emulator-controls

## Spike

EmulatorJS `stable` = 4.2.3 (`this.ejs_version` in `cdn.emulatorjs.org/stable/data/emulator.min.js`), read from source on 2026-11-11. No owner ROM was run yet.

| # | Answer | Source | Decision |
|---|---|---|---|
| S1 | `gameManager.simulateInput(player, index, value)` exists; the EmulatorJS keyboard and gamepad paths call it the same way | source | FD2 viable. Still to confirm with 1 ROM that the game moves |
| S2 | `keyChange` matches only on the control `value`; an empty `value` binds no key | source | `INPUT_PATH=listener` |
| S3 | Analog: 16/17 = X+/X−, 18/19 = Y+/Y−, value `32767 * axis` | source | `EJS_INDEX` as in plan.md. Rows of `BUTTON_INDEX` stay provisional until a ROM per console runs |
| S4 | Not checked (no Mega Drive ROM) | — | `BUTTON_INDEX.megadrive` provisional |
| S5 | Not checked with a ROM | — | `segaMS` / `segaGG` set; if refused, RN01 is kept by the RetroKey 2-button map |
| S6 | Not checked (needs a physical pad, T27) | — | pending, owner |
| S7 | Setting key `virtual-gamepad` (`enabled`/`disabled`), read from `config.defaultOptions` | source | `EJS_defaultOptions['virtual-gamepad'] = 'disabled'` plus CSS hide of `.ejs_virtualGamepad_parent` |
| S8 | Not needed under `INPUT_PATH=listener` | — | — |

INPUT_PATH=listener

## Impact (before editing)

- `Emulator`, `PlayStage`, `StatusStrip`: GitNexus `impact` upstream = `UNKNOWN` (JSX not indexed). Text search: `Emulator` and `StatusStrip` are imported only by `components/PlayStage.tsx`; `PlayStage` only by `app/play/[slug]/page.tsx`; `/emulator.html` is loaded only by `components/Emulator.tsx`.
- `playThemeCssVars`: LOW, 1 caller (`PlayStage`). Left unchanged; `--t-on-frame` is computed in `PlayStage`.

## Owner decision applied

2026-11-11: handheld body (portrait + touch) for the 12 consoles in each console's colors; the rotate hint is dropped. See design.md TL;DR and epic.md Notes.

## Gates (2026-11-11)

- `node --import tsx --test` (7 files, AGENTS.md gate): 84/84 pass.
- `npm run build`: pass.
- `e2e/play-screen.qa.spec.ts --project=main`: SF02 43/43 pass; T07 and SF04-T35 updated for the `console` param and the dialog markup, then re-run green.
- `e2e/play-screen.qa.spec.ts --project=no-mongo` (`.next` deleted first): 81/81 pass.

## Pending

- T27 / S6: one physical pad on a real ROM (owner).
- S1/S4/S5 with real ROMs: check that each console's button indices move the game.
