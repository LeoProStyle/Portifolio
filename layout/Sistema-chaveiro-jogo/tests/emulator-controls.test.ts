import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BEZEL_CONSOLE_IDS } from '../lib/bezel-console';
import * as controls from '../lib/emulator-controls';
import {
  ANALOG_INDICES,
  ANALOG_MAX,
  BUTTONS_BY_CONSOLE,
  CONSOLE_SCHEMES,
  CONTROLS_STORAGE_PREFIX,
  DEFAULT_CONTROL_MAPS,
  GAMEPAD_LABELS,
  KEY_CODES,
  applyRemap,
  buttonIndex,
  buttonLabel,
  consoleIdForSystem,
  controlsStorageKey,
  inputMessage,
  isKeyCode,
  isTrustedMessage,
  keyCapLabel,
  legendGroups,
  parseEmulatorMessage,
  parsePageMessage,
  parseSavedControlMap,
  resolveControlMap,
  serializeControlMap,
  toControlsMessage,
  validateControlMap
} from '../lib/emulator-controls';

// 0002F SF02 contract tests T01-T19 and T47 (plan.md Test Specification). INPUT_PATH=listener, so no T20.

test('T01 lib-RF01-default-map-for-12-consoles', () => {
  assert.deepEqual(Object.keys(DEFAULT_CONTROL_MAPS).sort(), [...BEZEL_CONSOLE_IDS].sort());
  for (const id of BEZEL_CONSOLE_IDS) {
    const map = DEFAULT_CONTROL_MAPS[id];
    assert.deepEqual(Object.keys(map).sort(), [...BUTTONS_BY_CONSOLE[id]].sort(), id);
    const result = validateControlMap(map, id);
    assert.equal(result.ok, true, id);
    if (result.ok) assert.deepEqual(result.map, map);
  }
});

test('T02 lib-RF01-every-button-has-ejs-index', () => {
  for (const id of BEZEL_CONSOLE_IDS) {
    for (const button of BUTTONS_BY_CONSOLE[id]) {
      const index = buttonIndex(id, button);
      assert.ok(index !== null && Number.isInteger(index) && index >= 0 && index <= 23, `${id} ${button}`);
    }
    assert.equal(toControlsMessage(DEFAULT_CONTROL_MAPS[id], id).bindings.length, BUTTONS_BY_CONSOLE[id].length);
  }
  assert.equal(buttonIndex('nes', 'c'), null);
});

test('T03 lib-RF02-legend-groups-and-labels', () => {
  for (const id of ['nes', 'n64', 'arcade', 'ps'] as const) {
    assert.deepEqual(
      legendGroups(id).flatMap((group) => group.buttons),
      [...BUTTONS_BY_CONSOLE[id]]
    );
  }
  assert.deepEqual(
    legendGroups('n64').map((group) => group.label),
    ['Stick', 'D-pad', 'A', 'B', 'C', 'Z', 'L', 'R', 'Start']
  );
  assert.equal(legendGroups('n64').length, 9);
  assert.equal(legendGroups('ps').length, 11);
  assert.equal(legendGroups('arcade')[0].label, 'Stick');
  assert.equal(legendGroups('nes')[0].label, 'D-pad');
  assert.equal(buttonLabel('sms', 'start'), 'Pause');
  assert.equal(buttonLabel('gamegear', 'start'), 'Start');
  assert.deepEqual(
    (['KeyX', 'Digit5', 'ArrowUp', 'Enter', 'Space'] as const).map(keyCapLabel),
    ['X', '5', '↑', 'Enter', 'Space']
  );
});

test('T04 lib-RF03-gamepad-label-table', () => {
  assert.equal(Object.keys(GAMEPAD_LABELS).length, 24);
  assert.equal(GAMEPAD_LABELS[0], 'BUTTON_2');
  assert.equal(GAMEPAD_LABELS[8], 'BUTTON_1');
  assert.deepEqual(
    [GAMEPAD_LABELS[4], GAMEPAD_LABELS[5], GAMEPAD_LABELS[6], GAMEPAD_LABELS[7]],
    ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT']
  );
  assert.deepEqual(
    [GAMEPAD_LABELS[10], GAMEPAD_LABELS[11], GAMEPAD_LABELS[12], GAMEPAD_LABELS[13]],
    ['LEFT_TOP_SHOULDER', 'RIGHT_TOP_SHOULDER', 'LEFT_BOTTOM_SHOULDER', 'RIGHT_BOTTOM_SHOULDER']
  );
  assert.deepEqual(
    [GAMEPAD_LABELS[16], GAMEPAD_LABELS[17], GAMEPAD_LABELS[18], GAMEPAD_LABELS[19]],
    ['LEFT_STICK_X:+1', 'LEFT_STICK_X:-1', 'LEFT_STICK_Y:+1', 'LEFT_STICK_Y:-1']
  );
  assert.deepEqual([...ANALOG_INDICES], [16, 17, 18, 19, 20, 21, 22, 23]);
  assert.equal(ANALOG_MAX, 0x7fff);
});

test('T05 lib-RF04-apply-remap-free-and-swap', () => {
  const base = DEFAULT_CONTROL_MAPS.nes;
  const before = JSON.stringify(base);
  const free = applyRemap(base, 'nes', 'a', 'KeyV');
  assert.equal(free.swappedWith, null);
  assert.equal(free.map.a, 'KeyV');
  const swap = applyRemap(base, 'nes', 'a', 'KeyZ');
  assert.equal(swap.swappedWith, 'b');
  assert.equal(swap.map.a, 'KeyZ');
  assert.equal(swap.map.b, 'KeyX');
  assert.equal(validateControlMap(free.map, 'nes').ok, true);
  assert.equal(validateControlMap(swap.map, 'nes').ok, true);
  assert.equal(JSON.stringify(base), before);
});

test('T06 lib-RF04-storage-key-and-roundtrip', () => {
  assert.equal(controlsStorageKey('nes'), 'retrokey:controls:v1:nes');
  assert.ok(controlsStorageKey('nes').startsWith(CONTROLS_STORAGE_PREFIX));
  const map = applyRemap(DEFAULT_CONTROL_MAPS.nes, 'nes', 'a', 'KeyV').map;
  assert.deepEqual(parseSavedControlMap(serializeControlMap(map), 'nes'), map);
  for (const raw of [null, '{', '[]', '"x"', serializeControlMap(DEFAULT_CONTROL_MAPS.snes)]) {
    assert.equal(parseSavedControlMap(raw, 'nes'), null, String(raw));
  }
});

test('T07 lib-RF06-module-exports-for-sf03', () => {
  assert.equal(typeof controls.validateControlMap, 'function');
  assert.equal(typeof controls.resolveControlMap, 'function');
  assert.equal(typeof controls.isKeyCode, 'function');
  assert.equal(typeof controls.DEFAULT_CONTROL_MAPS, 'object');
  assert.equal(typeof controls.BUTTONS_BY_CONSOLE, 'object');
  assert.equal(typeof controls.KEY_CODES, 'object');
  const source = readFileSync(join(process.cwd(), 'lib', 'emulator-controls.ts'), 'utf8');
  assert.doesNotMatch(source, /from ['"](react|fs|node:fs)['"]/);
  assert.doesNotMatch(source, /\b(window|document)\./);
});

test('T08 lib-RN01-ms-gg-own-2-button-scheme', () => {
  for (const id of ['sms', 'gamegear'] as const) {
    assert.deepEqual([...BUTTONS_BY_CONSOLE[id]], ['up', 'down', 'left', 'right', '1', '2', 'start']);
    assert.equal(buttonIndex(id, '1'), 0);
    assert.equal(buttonIndex(id, '2'), 8);
    assert.equal(DEFAULT_CONTROL_MAPS[id]['1'], 'KeyZ');
    assert.equal(DEFAULT_CONTROL_MAPS[id]['2'], 'KeyX');
  }
  assert.equal(CONSOLE_SCHEMES.sms, 'segaMS');
  assert.equal(CONSOLE_SCHEMES.gamegear, 'segaGG');
});

test('T09 lib-RN01-ms-gg-not-mega-drive', () => {
  assert.equal(CONSOLE_SCHEMES.megadrive, 'segaMD');
  for (const id of BEZEL_CONSOLE_IDS) {
    if (id !== 'megadrive') assert.notEqual(CONSOLE_SCHEMES[id], 'segaMD', id);
  }
  const md = validateControlMap(DEFAULT_CONTROL_MAPS.megadrive, 'sms');
  assert.equal(md.ok, false);
  if (!md.ok) assert.equal(md.error, 'unknown-button');
  const withC = validateControlMap({ ...DEFAULT_CONTROL_MAPS.sms, c: 'KeyC' }, 'sms');
  assert.equal(withC.ok, false);
  if (!withC.ok) assert.equal(withC.error, 'unknown-button');
  for (const id of ['sms', 'gamegear'] as const) {
    for (const button of ['a', 'b', 'c'] as const) assert.ok(!BUTTONS_BY_CONSOLE[id].includes(button));
  }
});

test('T10 lib-RN02-valid-map-accepted', () => {
  const plain = { ...DEFAULT_CONTROL_MAPS.nes };
  const nullProto = Object.assign(Object.create(null), plain);
  for (const input of [plain, nullProto]) {
    const result = validateControlMap(input, 'nes');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Object.isFrozen(result.map));
      assert.notEqual(result.map, input);
      assert.deepEqual({ ...result.map }, plain);
    }
  }
});

test('T11 lib-RN02-validate-rejects-each-error', () => {
  const nes = DEFAULT_CONTROL_MAPS.nes;
  const error = (input: unknown) => {
    const result = validateControlMap(input, 'nes');
    assert.equal(result.ok, false);
    return result.ok ? null : result;
  };
  for (const input of [null, '{"a":"KeyX"}', [], 42, new Map()]) assert.equal(error(input)?.error, 'not-object');
  assert.deepEqual(error({ ...nes, c: 'KeyC' }), { ok: false, error: 'unknown-button', button: 'c' });
  assert.equal(error(JSON.parse(`{"__proto__":{"x":1},${JSON.stringify(nes).slice(1)}`))?.error, 'unknown-button');
  const withoutStart: Record<string, unknown> = { ...nes };
  delete withoutStart.start;
  assert.deepEqual(error(withoutStart), { ok: false, error: 'missing-button', button: 'start' });
  for (const code of ['keyx', 'Tab', 'Escape', 'F1', 'ShiftLeft', '', 42]) {
    assert.equal(error({ ...nes, a: code })?.error, 'invalid-code', String(code));
    assert.equal(isKeyCode(code), false, String(code));
  }
  assert.equal(error({ ...nes, a: 'KeyZ' })?.error, 'duplicate-code');
  assert.equal(isKeyCode('KeyX'), true);
  for (const banned of ['Tab', 'Escape', 'F12', 'ShiftRight', 'ControlLeft', 'AltLeft', 'MetaRight', 'CapsLock', 'ContextMenu']) {
    assert.ok(!(KEY_CODES as readonly string[]).includes(banned), banned);
  }
});

test('T12 lib-RN02-page-message-valid', () => {
  const message = toControlsMessage(DEFAULT_CONTROL_MAPS.nes, 'nes');
  assert.deepEqual(parsePageMessage(message, 'nes'), message);
  const input = inputMessage('nes', 'a', true);
  assert.deepEqual(input, { type: 'RK_INPUT', index: 8, pressed: true });
  assert.deepEqual(parsePageMessage(input, 'nes'), input);
  assert.deepEqual(parsePageMessage({ type: 'RK_RELEASE_ALL' }, 'nes'), { type: 'RK_RELEASE_ALL' });
  assert.deepEqual(parseEmulatorMessage({ type: 'EMULATOR_CANVAS_READY' }), { type: 'EMULATOR_CANVAS_READY' });
  assert.equal(inputMessage('nes', 'c', true), null);
});

test('T13 lib-RN02-page-message-rejects-malformed', () => {
  const valid = toControlsMessage(DEFAULT_CONTROL_MAPS.nes, 'nes');
  const cases: unknown[] = [
    JSON.stringify(valid),
    { ...valid, extra: 1 },
    { ...valid, console: 'snes' },
    { ...valid, bindings: [['KeyZ', 24]] },
    { ...valid, bindings: [['KeyZ', -1]] },
    { ...valid, bindings: [['KeyZ', 1.5]] },
    { ...valid, bindings: [['KeyZ', '8']] },
    { ...valid, bindings: [['Tab', 0]] },
    { ...valid, bindings: Array.from({ length: 25 }, (_, i) => [KEY_CODES[i], 0]) },
    { ...valid, bindings: [['KeyZ', 0], ['KeyZ', 8]] },
    { ...valid, bindings: [['KeyZ', 0, 1]] },
    { type: 'RK_INPUT', index: 8, pressed: 'true' },
    { type: 'RK_INPUT', index: 24, pressed: true },
    { type: 'RK_RELEASE_ALL', extra: true },
    { type: 'RK_UNKNOWN' }
  ];
  cases.forEach((data, i) => assert.equal(parsePageMessage(data, 'nes'), null, `case ${i}`));
  assert.equal(parseEmulatorMessage({ type: 'EMULATOR_CANVAS_READY', extra: 1 }), null);
  assert.equal(parseEmulatorMessage('EMULATOR_CANVAS_READY'), null);
});

test('T14 lib-RN02-console-id-picks-default-only-without-map', () => {
  assert.deepEqual(resolveControlMap(undefined, undefined, 'snes'), { map: DEFAULT_CONTROL_MAPS.snes, source: 'default' });
  const saved = applyRemap(DEFAULT_CONTROL_MAPS.snes, 'snes', 'a', 'KeyV').map;
  const resolved = resolveControlMap(saved, undefined, 'snes');
  assert.equal(resolved.source, 'player');
  assert.deepEqual(resolved.map, saved);
});

test('T15 lib-RN03-trusted-sender-accepted', () => {
  const source = {};
  assert.equal(isTrustedMessage({ origin: 'http://localhost:3001', source }, 'http://localhost:3001', source), true);
});

test('T16 lib-RN03-foreign-sender-rejected', () => {
  const origin = 'http://localhost:3001';
  const source = {};
  assert.equal(isTrustedMessage({ origin: 'https://evil.example', source }, origin, source), false);
  assert.equal(isTrustedMessage({ origin: 'null', source }, origin, source), false);
  assert.equal(isTrustedMessage({ origin: `${origin}/`, source }, origin, source), false);
  assert.equal(isTrustedMessage({ origin, source: {} }, origin, source), false);
  assert.equal(isTrustedMessage({ origin, source: null }, origin, null), false);
  assert.equal(isTrustedMessage({ origin, source: undefined }, origin, undefined), false);
});

test('T17 lib-RN04-resolve-precedence', () => {
  const player = applyRemap(DEFAULT_CONTROL_MAPS.nes, 'nes', 'a', 'KeyV').map;
  const admin = applyRemap(DEFAULT_CONTROL_MAPS.nes, 'nes', 'a', 'KeyM').map;
  assert.deepEqual(resolveControlMap(player, admin, 'nes'), { map: player, source: 'player' });
  assert.deepEqual(resolveControlMap({ a: 'Tab' }, admin, 'nes'), { map: admin, source: 'admin' });
  assert.deepEqual(resolveControlMap('junk', 42, 'nes'), { map: DEFAULT_CONTROL_MAPS.nes, source: 'default' });
});

test('T18 lib-RN04-saved-map-invalid-or-cleared', () => {
  for (const saved of [null, DEFAULT_CONTROL_MAPS.snes, { ...DEFAULT_CONTROL_MAPS.nes, a: 'Tab' }]) {
    assert.notEqual(resolveControlMap(saved, undefined, 'nes').source, 'player');
  }
});

test('T19 lib-RF06-emulator-html-contract-block', () => {
  const html = readFileSync(join(process.cwd(), 'public', 'emulator.html'), 'utf8');
  const match = html.match(/<script type="application\/json" id="rk-controls-contract">([\s\S]*?)<\/script>/);
  assert.ok(match, 'contract block present');
  const block = JSON.parse(match[1]);
  assert.deepEqual(block.consoles, [...BEZEL_CONSOLE_IDS]);
  assert.deepEqual(block.schemes, CONSOLE_SCHEMES);
  assert.deepEqual(block.keyCodes, [...KEY_CODES]);
  assert.deepEqual(block.gamepad, Object.fromEntries(Object.entries(GAMEPAD_LABELS)));
  assert.deepEqual(block.analog, [...ANALOG_INDICES]);
  assert.doesNotMatch(html, /postMessage\([^)]*'\*'\)/);
});

test('T47 lib-RF06-console-id-from-system', () => {
  assert.equal(consoleIdForSystem('NES'), 'nes');
  assert.equal(consoleIdForSystem('Game Boy'), 'dmg');
  assert.equal(consoleIdForSystem('Master System'), 'sms');
  assert.equal(consoleIdForSystem('Game Gear'), 'gamegear');
  assert.equal(consoleIdForSystem('Mega Drive / Genesis'), 'megadrive');
  assert.equal(consoleIdForSystem('Arcade'), 'arcade');
  assert.equal(consoleIdForSystem('gba'), 'gba');
  assert.equal(consoleIdForSystem(''), null);
  assert.equal(consoleIdForSystem(null), null);
  assert.equal(consoleIdForSystem('xbox'), null);
});
