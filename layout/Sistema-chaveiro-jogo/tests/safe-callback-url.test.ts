import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCallbackUrl } from '../lib/safe-callback-url';

const ORIGIN = 'https://retrokey.example';

test('T28 the post-login redirect stays on the same origin', () => {
  assert.equal(safeCallbackUrl('/admin', ORIGIN), '/admin');
  assert.equal(safeCallbackUrl('/admin?tab=games#top', ORIGIN), '/admin?tab=games#top');
  for (const hostile of [null, '', 'admin', 'https://evil.example/', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', ' /admin', 'javascript:alert(1)']) {
    assert.equal(safeCallbackUrl(hostile, ORIGIN), '/admin', `expected /admin for ${JSON.stringify(hostile)}`);
  }
});
