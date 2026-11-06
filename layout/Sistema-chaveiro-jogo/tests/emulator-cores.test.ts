import test from 'node:test';
import assert from 'node:assert/strict';
import * as cores from '../lib/emulator-cores';

// 0002F SF01 contract test T04 (plan.md Test Specification).
// The expected cores below were read from lib/emulator-cores.ts before resolveEmulatorSystem was
// extracted. Every row must keep returning the same core after the refactor.
// The namespace import keeps the getCoreForSystem rows runnable while resolveEmulatorSystem is missing.

type Row = { input: string | null | undefined; core: string; system: cores.EmulatorSystem | null };

const EXACT: Row[] = [
  { input: 'NES', core: 'fceumm', system: 'NES' },
  { input: 'SNES', core: 'snes9x', system: 'SNES' },
  { input: 'Nintendo 64', core: 'mupen64plus_next', system: 'Nintendo 64' },
  { input: 'Game Boy', core: 'gambatte', system: 'Game Boy' },
  { input: 'Game Boy Color', core: 'gambatte', system: 'Game Boy Color' },
  { input: 'Game Boy Advance', core: 'mgba', system: 'Game Boy Advance' },
  { input: 'Master System', core: 'genesis_plus_gx', system: 'Master System' },
  { input: 'Mega Drive / Genesis', core: 'genesis_plus_gx', system: 'Mega Drive / Genesis' },
  { input: 'Game Gear', core: 'genesis_plus_gx', system: 'Game Gear' },
  { input: 'PlayStation', core: 'pcsx_rearmed', system: 'PlayStation' },
  { input: 'Arcade (FBNeo)', core: 'fbneo', system: 'Arcade (FBNeo)' },
  { input: 'Neo Geo', core: 'fbneo', system: 'Neo Geo' },
  { input: '  snes  ', core: 'snes9x', system: 'SNES' },
  { input: 'game boy color', core: 'gambatte', system: 'Game Boy Color' }
];

const LEGACY: Row[] = [
  { input: 'Arcade', core: 'fbneo', system: 'Arcade (FBNeo)' },
  { input: 'FBNeo', core: 'fbneo', system: 'Arcade (FBNeo)' },
  { input: 'Mega Drive', core: 'genesis_plus_gx', system: 'Mega Drive / Genesis' },
  { input: 'Genesis', core: 'genesis_plus_gx', system: 'Mega Drive / Genesis' },
  { input: 'Sega Mega Drive', core: 'genesis_plus_gx', system: 'Mega Drive / Genesis' },
  { input: 'N64', core: 'mupen64plus_next', system: 'Nintendo 64' },
  { input: 'GBA', core: 'mgba', system: 'Game Boy Advance' },
  { input: 'GBC', core: 'gambatte', system: 'Game Boy Color' },
  { input: 'gb', core: 'gambatte', system: 'Game Boy' },
  { input: 'Game Boy Pocket', core: 'gambatte', system: 'Game Boy' },
  { input: 'Super Nintendo', core: 'snes9x', system: 'SNES' },
  { input: 'SFC', core: 'snes9x', system: 'SNES' },
  { input: 'nes', core: 'fceumm', system: 'NES' },
  { input: 'Nintendo NES', core: 'fceumm', system: 'NES' },
  { input: 'PSX', core: 'pcsx_rearmed', system: 'PlayStation' },
  { input: 'PlayStation 1', core: 'pcsx_rearmed', system: 'PlayStation' },
  { input: 'neo geo aes', core: 'fbneo', system: 'Neo Geo' }
];

const UNKNOWN: Row[] = [
  { input: '', core: 'fceumm', system: null },
  { input: null, core: 'fceumm', system: null },
  { input: undefined, core: 'fceumm', system: null },
  { input: 'Atari Jaguar', core: 'fceumm', system: null },
  { input: 'Famicom', core: 'fceumm', system: null },
  { input: 'Master System II', core: 'fceumm', system: null }
];

const ALL = [...EXACT, ...LEGACY, ...UNKNOWN];

function quiet<T>(fn: () => T): T {
  const saved = { info: console.info, warn: console.warn };
  console.info = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.info = saved.info;
    console.warn = saved.warn;
  }
}

test('T04 getCoreForSystem keeps the same core for every exact name, alias and unknown value', () => {
  for (const row of ALL) {
    assert.equal(quiet(() => cores.getCoreForSystem(row.input)), row.core, String(row.input));
  }
});

test('T04 resolveEmulatorSystem returns the system the core table is keyed by', () => {
  for (const row of ALL) {
    assert.equal(cores.resolveEmulatorSystem(row.input), row.system, String(row.input));
  }
});

test('T04 resolved system and core agree with systemToCoreMap', () => {
  for (const row of [...EXACT, ...LEGACY]) {
    const system = cores.resolveEmulatorSystem(row.input);
    assert.ok(system, String(row.input));
    assert.equal(cores.systemToCoreMap[system], row.core, String(row.input));
  }
});

test('T04 Game Boy and Game Boy Color share a core but resolve to different systems', () => {
  assert.equal(cores.systemToCoreMap['Game Boy'], cores.systemToCoreMap['Game Boy Color']);
  assert.notEqual(cores.resolveEmulatorSystem('Game Boy'), cores.resolveEmulatorSystem('Game Boy Color'));
});
