import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRomObjectKey } from '../lib/r2';

test('buildRomObjectKey uses a sanitized slug and preserves the extension', () => {
  assert.equal(
    buildRomObjectKey('Sonic The Hedgehog', 'Sonic The Hedgehog (USA, Europe).gen'),
    'roms/sonic-the-hedgehog.gen'
  );
});

test('buildRomObjectKey falls back to .bin when the file has no extension', () => {
  assert.equal(buildRomObjectKey('my-game', 'my-game'), 'roms/my-game.bin');
});
