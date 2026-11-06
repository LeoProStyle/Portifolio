import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { verifyPasswordHash } from '../lib/password';

const SCRIPT = resolve(__dirname, '..', 'scripts', 'hash-admin-password.ts');
// Fixture value only.
const PASSWORD = 'script-fixture-pass';

function runScript(input: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
    input,
    encoding: 'utf8',
    cwd: resolve(__dirname, '..'),
    timeout: 30_000
  });
}

test('T25 the hash script prints one verifiable hash and never echoes the password', async () => {
  const run = runScript(`${PASSWORD}\n`);
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.split(/\r?\n/).filter((line) => line.length > 0);
  assert.equal(lines.length, 1, `expected one stdout line, got: ${JSON.stringify(lines)}`);
  assert.match(lines[0], /^scrypt:131072:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPasswordHash(PASSWORD, lines[0]), true);
  assert.equal(run.stdout.includes(PASSWORD), false);
  assert.equal(run.stderr.includes(PASSWORD), false);
});

test('T25 the hash script refuses empty input and passwords under 12 characters', () => {
  for (const input of ['\n', 'short-pass1\n']) {
    const run = runScript(input);
    assert.notEqual(run.status, 0, `expected refusal for ${JSON.stringify(input)}`);
    assert.equal(run.stdout.trim(), '');
    assert.equal(run.stderr.includes('short-pass1'), false);
  }
});
