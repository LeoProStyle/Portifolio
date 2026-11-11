import { BEZEL_CONSOLE_IDS, type BezelConsoleId } from '@/lib/bezel-console';
import { resolveEmulatorSystem } from '@/lib/emulator-cores';
import { DEFAULT_PLAY_THEMES } from '@/lib/play-theme';

// Controls contract of 0002F SF02 (plan.md Frontend → Exported signatures). Pure module: no React,
// no fs, no DOM global at import. public/emulator.html mirrors part of it in #rk-controls-contract
// (checked by tests/emulator-controls.test.ts); SF03 reuses the validation (RF06).

// RetroPad indices of EmulatorJS 4.2.3 (gameManager.simulateInput(player, index, value)).
export const EJS_INDEX = {
  B: 0,
  Y: 1,
  SELECT: 2,
  START: 3,
  UP: 4,
  DOWN: 5,
  LEFT: 6,
  RIGHT: 7,
  A: 8,
  X: 9,
  L: 10,
  R: 11,
  L2: 12,
  R2: 13,
  L3: 14,
  R3: 15,
  LSTICK_RIGHT: 16,
  LSTICK_LEFT: 17,
  LSTICK_DOWN: 18,
  LSTICK_UP: 19,
  RSTICK_RIGHT: 20,
  RSTICK_LEFT: 21,
  RSTICK_DOWN: 22,
  RSTICK_UP: 23
} as const;
export type EjsIndex = (typeof EJS_INDEX)[keyof typeof EJS_INDEX];

// Analog axes take ANALOG_MAX when pressed; digital buttons take 1; release is 0.
export const ANALOG_INDICES: readonly EjsIndex[] = Object.freeze([16, 17, 18, 19, 20, 21, 22, 23] as EjsIndex[]);
export const ANALOG_MAX = 0x7fff;

export const CONSOLE_BUTTONS = [
  'up',
  'down',
  'left',
  'right',
  'stick-up',
  'stick-down',
  'stick-left',
  'stick-right',
  'a',
  'b',
  'c',
  'd',
  'x',
  'y',
  'l',
  'r',
  'l1',
  'l2',
  'r1',
  'r2',
  'z',
  'c-up',
  'c-down',
  'c-left',
  'c-right',
  '1',
  '2',
  'square',
  'triangle',
  'cross',
  'circle',
  'select',
  'start',
  'coin'
] as const;
export type ConsoleButton = (typeof CONSOLE_BUTTONS)[number];

const DPAD = ['up', 'down', 'left', 'right'] as const;
const STICK = ['stick-up', 'stick-down', 'stick-left', 'stick-right'] as const;
const C_BUTTONS = ['c-up', 'c-down', 'c-left', 'c-right'] as const;

const NINTENDO_8BIT: readonly ConsoleButton[] = [...DPAD, 'b', 'a', 'select', 'start'];
const SEGA_2BUTTON: readonly ConsoleButton[] = [...DPAD, '1', '2', 'start'];
const ARCADE: readonly ConsoleButton[] = [...DPAD, 'a', 'b', 'c', 'd', 'coin', 'start'];

// Closed list per console, in the order of design.md "Botões por console".
export const BUTTONS_BY_CONSOLE: Record<BezelConsoleId, readonly ConsoleButton[]> = {
  nes: NINTENDO_8BIT,
  dmg: NINTENDO_8BIT,
  gbc: NINTENDO_8BIT,
  gba: [...DPAD, 'b', 'a', 'l', 'r', 'select', 'start'],
  snes: [...DPAD, 'y', 'x', 'b', 'a', 'l', 'r', 'select', 'start'],
  n64: [...STICK, ...DPAD, 'a', 'b', ...C_BUTTONS, 'z', 'l', 'r', 'start'],
  sms: SEGA_2BUTTON,
  gamegear: SEGA_2BUTTON,
  megadrive: [...DPAD, 'a', 'b', 'c', 'start'],
  ps: [...DPAD, 'square', 'triangle', 'cross', 'circle', 'l1', 'l2', 'r1', 'r2', 'select', 'start'],
  arcade: ARCADE,
  neogeo: ARCADE
};

const BASE_LABELS: Record<ConsoleButton, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  'stick-up': 'Stick up',
  'stick-down': 'Stick down',
  'stick-left': 'Stick left',
  'stick-right': 'Stick right',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  x: 'X',
  y: 'Y',
  l: 'L',
  r: 'R',
  l1: 'L1',
  l2: 'L2',
  r1: 'R1',
  r2: 'R2',
  z: 'Z',
  'c-up': 'C up',
  'c-down': 'C down',
  'c-left': 'C left',
  'c-right': 'C right',
  '1': '1',
  '2': '2',
  square: 'Square',
  triangle: 'Triangle',
  cross: 'Cross',
  circle: 'Circle',
  select: 'Select',
  start: 'Start',
  coin: 'Coin'
};

export function buttonLabel(consoleId: BezelConsoleId, button: ConsoleButton): string {
  if (consoleId === 'sms' && button === 'start') return 'Pause';
  return BASE_LABELS[button];
}

export type ButtonGroup = { label: string; buttons: readonly ConsoleButton[] };

const DIRECTION_SETS: readonly (readonly ConsoleButton[])[] = [DPAD, STICK, C_BUTTONS];

function directionGroupLabel(consoleId: BezelConsoleId, first: ConsoleButton): string {
  if (first === 'up') return consoleId === 'arcade' || consoleId === 'neogeo' ? 'Stick' : 'D-pad';
  if (first === 'stick-up') return 'Stick';
  return 'C';
}

// D-pad, Stick and the four C each collapse into one group; every other button is its own group.
export function legendGroups(consoleId: BezelConsoleId): readonly ButtonGroup[] {
  const buttons = BUTTONS_BY_CONSOLE[consoleId];
  const groups: ButtonGroup[] = [];
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const set = DIRECTION_SETS.find((candidate) => candidate[0] === button);
    if (set) {
      groups.push({ label: directionGroupLabel(consoleId, button), buttons: set });
      i += set.length - 1;
    } else {
      groups.push({ label: buttonLabel(consoleId, button), buttons: [button] });
    }
  }
  return groups;
}

const I = EJS_INDEX;
const DPAD_INDEX = { up: I.UP, down: I.DOWN, left: I.LEFT, right: I.RIGHT } as const;
const NINTENDO_8BIT_INDEX = { ...DPAD_INDEX, b: I.B, a: I.A, select: I.SELECT, start: I.START } as const;
const SEGA_2BUTTON_INDEX = { ...DPAD_INDEX, '1': I.B, '2': I.A, start: I.START } as const;
const ARCADE_INDEX = { ...DPAD_INDEX, a: I.B, b: I.A, c: I.Y, d: I.X, coin: I.SELECT, start: I.START } as const;

// Provisional RetroPad mapping (plan.md BUTTON_INDEX); rows are checked per console with a real ROM.
export const BUTTON_INDEX: Record<BezelConsoleId, Partial<Record<ConsoleButton, EjsIndex>>> = {
  nes: NINTENDO_8BIT_INDEX,
  dmg: NINTENDO_8BIT_INDEX,
  gbc: NINTENDO_8BIT_INDEX,
  gba: { ...NINTENDO_8BIT_INDEX, l: I.L, r: I.R },
  snes: { ...NINTENDO_8BIT_INDEX, y: I.Y, x: I.X, l: I.L, r: I.R },
  n64: {
    ...DPAD_INDEX,
    'stick-up': I.LSTICK_UP,
    'stick-down': I.LSTICK_DOWN,
    'stick-left': I.LSTICK_LEFT,
    'stick-right': I.LSTICK_RIGHT,
    a: I.B,
    b: I.Y,
    'c-up': I.RSTICK_UP,
    'c-down': I.RSTICK_DOWN,
    'c-left': I.RSTICK_LEFT,
    'c-right': I.RSTICK_RIGHT,
    z: I.L2,
    l: I.L,
    r: I.R,
    start: I.START
  },
  sms: SEGA_2BUTTON_INDEX,
  gamegear: SEGA_2BUTTON_INDEX,
  megadrive: { ...DPAD_INDEX, a: I.Y, b: I.B, c: I.A, start: I.START },
  ps: {
    ...DPAD_INDEX,
    cross: I.B,
    circle: I.A,
    square: I.Y,
    triangle: I.X,
    l1: I.L,
    r1: I.R,
    l2: I.L2,
    r2: I.R2,
    select: I.SELECT,
    start: I.START
  },
  arcade: ARCADE_INDEX,
  neogeo: ARCADE_INDEX
};

export function buttonIndex(consoleId: BezelConsoleId, button: ConsoleButton): EjsIndex | null {
  if (!BUTTONS_BY_CONSOLE[consoleId].includes(button)) return null;
  const index = BUTTON_INDEX[consoleId][button];
  return index === undefined ? null : index;
}

// Closed list of KeyboardEvent.code values a player can bind. Tab, Escape, F1-F12, modifiers,
// CapsLock and ContextMenu are left out (design.md Keys panel `rejected`).
export const KEY_CODES = Object.freeze([
  'KeyA',
  'KeyB',
  'KeyC',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyI',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyM',
  'KeyN',
  'KeyO',
  'KeyP',
  'KeyQ',
  'KeyR',
  'KeyS',
  'KeyT',
  'KeyU',
  'KeyV',
  'KeyW',
  'KeyX',
  'KeyY',
  'KeyZ',
  'Digit0',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadEnter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Space',
  'Backspace',
  'Comma',
  'Period',
  'Slash',
  'Semicolon',
  'Quote',
  'BracketLeft',
  'BracketRight',
  'Minus',
  'Equal',
  'Backslash',
  'Backquote',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown'
] as const);
export type KeyCode = (typeof KEY_CODES)[number];

const KEY_CODE_SET: ReadonlySet<string> = new Set(KEY_CODES);

export function isKeyCode(value: unknown): value is KeyCode {
  return typeof value === 'string' && KEY_CODE_SET.has(value);
}

const KEYCAP_NAMES: Partial<Record<KeyCode, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadEnter: 'Num Enter',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backslash: '\\',
  Backquote: '`',
  PageUp: 'PgUp',
  PageDown: 'PgDn'
};

export function keyCapLabel(code: KeyCode): string {
  const named = KEYCAP_NAMES[code];
  if (named) return named;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export type ControlMap = Readonly<Partial<Record<ConsoleButton, KeyCode>>>;

const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
const NINTENDO_8BIT_KEYS = { ...ARROWS, b: 'KeyZ', a: 'KeyX', select: 'Space', start: 'Enter' } as const;
const SEGA_2BUTTON_KEYS = { ...ARROWS, '1': 'KeyZ', '2': 'KeyX', start: 'Enter' } as const;
const ARCADE_KEYS = { ...ARROWS, a: 'KeyZ', b: 'KeyX', c: 'KeyA', d: 'KeyS', coin: 'Digit5', start: 'Enter' } as const;

// Default keyboard maps (RF01, plan.md OQ-3).
export const DEFAULT_CONTROL_MAPS: Record<BezelConsoleId, ControlMap> = {
  nes: Object.freeze({ ...NINTENDO_8BIT_KEYS }),
  dmg: Object.freeze({ ...NINTENDO_8BIT_KEYS }),
  gbc: Object.freeze({ ...NINTENDO_8BIT_KEYS }),
  gba: Object.freeze({ ...NINTENDO_8BIT_KEYS, l: 'KeyQ', r: 'KeyW' }),
  snes: Object.freeze({ ...NINTENDO_8BIT_KEYS, y: 'KeyA', x: 'KeyS', l: 'KeyQ', r: 'KeyW' }),
  n64: Object.freeze({
    'stick-up': 'ArrowUp',
    'stick-down': 'ArrowDown',
    'stick-left': 'ArrowLeft',
    'stick-right': 'ArrowRight',
    up: 'KeyI',
    down: 'KeyK',
    left: 'KeyJ',
    right: 'KeyL',
    a: 'KeyX',
    b: 'KeyZ',
    'c-up': 'KeyT',
    'c-down': 'KeyG',
    'c-left': 'KeyF',
    'c-right': 'KeyH',
    z: 'KeyE',
    l: 'KeyQ',
    r: 'KeyW',
    start: 'Enter'
  }),
  sms: Object.freeze({ ...SEGA_2BUTTON_KEYS }),
  gamegear: Object.freeze({ ...SEGA_2BUTTON_KEYS }),
  megadrive: Object.freeze({ ...ARROWS, a: 'KeyZ', b: 'KeyX', c: 'KeyC', start: 'Enter' }),
  ps: Object.freeze({
    ...ARROWS,
    cross: 'KeyZ',
    circle: 'KeyX',
    square: 'KeyA',
    triangle: 'KeyS',
    l1: 'KeyQ',
    r1: 'KeyW',
    l2: 'KeyE',
    r2: 'KeyR',
    select: 'Space',
    start: 'Enter'
  }),
  arcade: Object.freeze({ ...ARCADE_KEYS }),
  neogeo: Object.freeze({ ...ARCADE_KEYS })
};

export type EjsControlScheme = 'nes' | 'snes' | 'n64' | 'gb' | 'gba' | 'segaMS' | 'segaGG' | 'segaMD' | 'psx' | 'arcade';

export const CONSOLE_SCHEMES: Record<BezelConsoleId, EjsControlScheme> = {
  nes: 'nes',
  snes: 'snes',
  n64: 'n64',
  dmg: 'gb',
  gbc: 'gb',
  gba: 'gba',
  sms: 'segaMS',
  megadrive: 'segaMD',
  gamegear: 'segaGG',
  ps: 'psx',
  arcade: 'arcade',
  neogeo: 'arcade'
};

// EmulatorJS gamepad names (value2) per RetroPad index (RF03, native EmulatorJS gamepad).
export const GAMEPAD_LABELS: Readonly<Record<EjsIndex, string>> = Object.freeze({
  0: 'BUTTON_2',
  1: 'BUTTON_4',
  2: 'SELECT',
  3: 'START',
  4: 'DPAD_UP',
  5: 'DPAD_DOWN',
  6: 'DPAD_LEFT',
  7: 'DPAD_RIGHT',
  8: 'BUTTON_1',
  9: 'BUTTON_3',
  10: 'LEFT_TOP_SHOULDER',
  11: 'RIGHT_TOP_SHOULDER',
  12: 'LEFT_BOTTOM_SHOULDER',
  13: 'RIGHT_BOTTOM_SHOULDER',
  14: 'LEFT_STICK',
  15: 'RIGHT_STICK',
  16: 'LEFT_STICK_X:+1',
  17: 'LEFT_STICK_X:-1',
  18: 'LEFT_STICK_Y:+1',
  19: 'LEFT_STICK_Y:-1',
  20: 'RIGHT_STICK_X:+1',
  21: 'RIGHT_STICK_X:-1',
  22: 'RIGHT_STICK_Y:+1',
  23: 'RIGHT_STICK_Y:-1'
});

export type ControlMapError = 'not-object' | 'unknown-button' | 'missing-button' | 'invalid-code' | 'duplicate-code';
export type ControlMapResult =
  | { ok: true; map: ControlMap }
  | { ok: false; error: ControlMapError; button?: ConsoleButton };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isConsoleButton(value: string): value is ConsoleButton {
  return (CONSOLE_BUTTONS as readonly string[]).includes(value);
}

// Plain object with exactly the console's buttons, each bound to a distinct KeyCode. Returns a
// fresh frozen copy (RN02). Reused by SF03 (RF06).
export function validateControlMap(input: unknown, consoleId: BezelConsoleId): ControlMapResult {
  if (!isPlainRecord(input)) return { ok: false, error: 'not-object' };
  const allowed = BUTTONS_BY_CONSOLE[consoleId];
  for (const key of Object.keys(input)) {
    if (!(allowed as readonly string[]).includes(key)) {
      return isConsoleButton(key) ? { ok: false, error: 'unknown-button', button: key } : { ok: false, error: 'unknown-button' };
    }
  }
  const seen = new Set<string>();
  const map: Partial<Record<ConsoleButton, KeyCode>> = {};
  for (const button of allowed) {
    if (!Object.prototype.hasOwnProperty.call(input, button)) return { ok: false, error: 'missing-button', button };
    const code = input[button];
    if (!isKeyCode(code)) return { ok: false, error: 'invalid-code', button };
    if (seen.has(code)) return { ok: false, error: 'duplicate-code', button };
    seen.add(code);
    map[button] = code;
  }
  return { ok: true, map: Object.freeze(map) };
}

// Player map > admin map > console default; the first that validates wins (RN04).
export function resolveControlMap(
  saved: unknown,
  adminMap: unknown,
  consoleId: BezelConsoleId
): { map: ControlMap; source: 'player' | 'admin' | 'default' } {
  const player = validateControlMap(saved, consoleId);
  if (player.ok) return { map: player.map, source: 'player' };
  const admin = validateControlMap(adminMap, consoleId);
  if (admin.ok) return { map: admin.map, source: 'admin' };
  return { map: DEFAULT_CONTROL_MAPS[consoleId], source: 'default' };
}

// Binds `code` to `button`; when another button already holds `code`, the two swap.
export function applyRemap(
  map: ControlMap,
  consoleId: BezelConsoleId,
  button: ConsoleButton,
  code: KeyCode
): { map: ControlMap; swappedWith: ConsoleButton | null } {
  const next: Partial<Record<ConsoleButton, KeyCode>> = { ...map };
  let swappedWith: ConsoleButton | null = null;
  const previous = map[button];
  for (const other of BUTTONS_BY_CONSOLE[consoleId]) {
    if (other !== button && map[other] === code) {
      swappedWith = other;
      if (previous) next[other] = previous;
      break;
    }
  }
  next[button] = code;
  const result = validateControlMap(next, consoleId);
  return result.ok ? { map: result.map, swappedWith } : { map, swappedWith: null };
}

export const CONTROLS_STORAGE_PREFIX = 'retrokey:controls:v1:';

export function controlsStorageKey(consoleId: BezelConsoleId): string {
  return `${CONTROLS_STORAGE_PREFIX}${consoleId}`;
}

export function parseSavedControlMap(raw: string | null, consoleId: BezelConsoleId): ControlMap | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = validateControlMap(parsed, consoleId);
  return result.ok ? result.map : null;
}

export function serializeControlMap(map: ControlMap): string {
  return JSON.stringify(map);
}

export type RkControlsMessage = {
  type: 'RK_CONTROLS';
  console: BezelConsoleId;
  bindings: ReadonlyArray<readonly [KeyCode, EjsIndex]>;
};
export type RkInputMessage = { type: 'RK_INPUT'; index: EjsIndex; pressed: boolean };
export type RkReleaseAllMessage = { type: 'RK_RELEASE_ALL' };
export type PageToEmulatorMessage = RkControlsMessage | RkInputMessage | RkReleaseAllMessage;
export type EmulatorToPageMessage = { type: 'EMULATOR_CANVAS_READY' };

export function toControlsMessage(map: ControlMap, consoleId: BezelConsoleId): RkControlsMessage {
  const bindings: Array<readonly [KeyCode, EjsIndex]> = [];
  for (const button of BUTTONS_BY_CONSOLE[consoleId]) {
    const code = map[button];
    const index = buttonIndex(consoleId, button);
    if (code && index !== null) bindings.push([code, index] as const);
  }
  return { type: 'RK_CONTROLS', console: consoleId, bindings };
}

export function inputMessage(consoleId: BezelConsoleId, button: ConsoleButton, pressed: boolean): RkInputMessage | null {
  const index = buttonIndex(consoleId, button);
  return index === null ? null : { type: 'RK_INPUT', index, pressed };
}

function isEjsIndex(value: unknown): value is EjsIndex {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

// Reference of the check public/emulator.html runs inline on every message from the page.
export function parsePageMessage(data: unknown, consoleId: BezelConsoleId): PageToEmulatorMessage | null {
  if (!isPlainRecord(data)) return null;
  if (data.type === 'RK_RELEASE_ALL') {
    return hasExactKeys(data, ['type']) ? { type: 'RK_RELEASE_ALL' } : null;
  }
  if (data.type === 'RK_INPUT') {
    if (!hasExactKeys(data, ['type', 'index', 'pressed'])) return null;
    if (!isEjsIndex(data.index) || typeof data.pressed !== 'boolean') return null;
    return { type: 'RK_INPUT', index: data.index, pressed: data.pressed };
  }
  if (data.type === 'RK_CONTROLS') {
    if (!hasExactKeys(data, ['type', 'console', 'bindings'])) return null;
    if (data.console !== consoleId || !Array.isArray(data.bindings) || data.bindings.length > 24) return null;
    const seen = new Set<string>();
    const bindings: Array<readonly [KeyCode, EjsIndex]> = [];
    for (const binding of data.bindings as unknown[]) {
      if (!Array.isArray(binding) || binding.length !== 2) return null;
      const [code, index] = binding as unknown[];
      if (!isKeyCode(code) || !isEjsIndex(index) || seen.has(code)) return null;
      seen.add(code);
      bindings.push([code, index] as const);
    }
    return { type: 'RK_CONTROLS', console: consoleId, bindings };
  }
  return null;
}

export function parseEmulatorMessage(data: unknown): EmulatorToPageMessage | null {
  if (!isPlainRecord(data) || !hasExactKeys(data, ['type'])) return null;
  return data.type === 'EMULATOR_CANVAS_READY' ? { type: 'EMULATOR_CANVAS_READY' } : null;
}

// RN03: the sender must be the expected window and the expected origin.
export function isTrustedMessage(
  event: { origin: string; source: unknown },
  expectedOrigin: string,
  expectedSource: unknown
): boolean {
  return expectedSource != null && event.source === expectedSource && event.origin === expectedOrigin;
}

// Console id from the game's system (exact name or legacy alias); never from a theme override.
export function consoleIdForSystem(system?: string | null): BezelConsoleId | null {
  if (!system || !system.trim()) return null;
  const resolved = resolveEmulatorSystem(system);
  if (!resolved) return null;
  const frame = DEFAULT_PLAY_THEMES[resolved]?.frame;
  return frame && (BEZEL_CONSOLE_IDS as readonly string[]).includes(frame) ? (frame as BezelConsoleId) : null;
}
