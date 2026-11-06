import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildRomObjectKey } from '../lib/r2';
import { classifyRomPath, romPathForCreate, romPathForUpdate } from '../lib/rom-path';

// SF04 rom-path-containment contract tests (plan.md Test Specification T01-T06).
// publicDir is injected, so no test touches a real file.
const PUBLIC_DIR = '/tmp/pub';

test('T01 R2 key in builder format is accepted as r2', () => {
  const keys = [
    'roms/super-mario.nes',
    'roms/a.zip',
    buildRomObjectKey('Sonic The Hedgehog', 'Sonic The Hedgehog (USA, Europe).gen'),
    buildRomObjectKey('my-game', 'my-game'),
    buildRomObjectKey('Super Mario!', 'GAME.NES'),
    buildRomObjectKey('', 'x')
  ];
  for (const key of keys) {
    assert.deepEqual(classifyRomPath(key, PUBLIC_DIR), { kind: 'r2', key }, key);
  }
});

test('T02 local path inside public/roms is accepted as local', () => {
  for (const name of ['super-retro.bin', '..%2f.env']) {
    assert.deepEqual(
      classifyRomPath(`/roms/${name}`, PUBLIC_DIR),
      { kind: 'local', absolutePath: path.resolve(PUBLIC_DIR, 'roms', name) },
      name
    );
  }
});

test('T03 traversal, absolute and malformed local paths are rejected', () => {
  for (const romPath of ['/roms/../.env', '/../.env', '../.env', '/etc/passwd', 'C:\\x', '/roms/a\0.bin', '/roms/']) {
    assert.equal(classifyRomPath(romPath, PUBLIC_DIR).kind, 'rejected', JSON.stringify(romPath));
  }
});

test('T04 R2-looking keys outside the builder format are rejected', () => {
  for (const romPath of ['roms/../rooms.json', 'roms/sub/x.bin', 'roms/X.BIN', '/roms']) {
    assert.equal(classifyRomPath(romPath, PUBLIC_DIR).kind, 'rejected', romPath);
  }
});

test('T05 empty or non-string romPath is rejected', () => {
  for (const romPath of ['', undefined, 42]) {
    assert.equal(classifyRomPath(romPath, PUBLIC_DIR).kind, 'rejected', String(romPath));
  }
});

test('T06 write helpers take romPath only from the upload', () => {
  assert.equal(romPathForCreate(undefined), '');
  assert.equal(romPathForCreate('roms/a.nes'), 'roms/a.nes');
  assert.deepEqual(romPathForUpdate(undefined), {});
  assert.deepEqual(romPathForUpdate('/roms/a.nes'), { romPath: '/roms/a.nes' });
});
