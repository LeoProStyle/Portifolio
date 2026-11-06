import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPasswordHash, verifyPlainPassword } from '../lib/password';

const HASH_SHAPE = /^scrypt:131072:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

test('T01 hash has the documented format, no $ and a unique salt', async () => {
  const first = await hashPassword('s3nh@-forte');
  const second = await hashPassword('s3nh@-forte');
  assert.match(first, HASH_SHAPE);
  assert.match(second, HASH_SHAPE);
  assert.equal(first.includes('$'), false);
  assert.notEqual(first, second);
});

test('T02 verifyPasswordHash accepts the right password and rejects wrong ones', async () => {
  const encoded = await hashPassword('correct-horse');
  assert.equal(await verifyPasswordHash('correct-horse', encoded), true);
  assert.equal(await verifyPasswordHash('Xorrect-horse', encoded), false);
  assert.equal(await verifyPasswordHash('correct-horsX', encoded), false);
  assert.equal(await verifyPasswordHash('correct-horse-and-more', encoded), false);
  assert.equal(await verifyPasswordHash('', encoded), false);
});

test('T03 a malformed hash returns false and never throws', async () => {
  for (const encoded of ['', 'plain', 'scrypt:x', 'scrypt:131072:8:1::', 'scrypt:131072:8:1:@@@:###', 'bcrypt:16384:8:1:abc:def']) {
    assert.equal(await verifyPasswordHash('anything', encoded), false, `expected false for "${encoded}"`);
  }
});

test('T04 plain comparison is length-safe', () => {
  assert.equal(verifyPlainPassword('admin123', 'admin123'), true);
  assert.equal(verifyPlainPassword('admin124', 'admin123'), false);
  assert.equal(verifyPlainPassword('admin1234', 'admin123'), false);
  assert.equal(verifyPlainPassword('', 'admin123'), false);
});
