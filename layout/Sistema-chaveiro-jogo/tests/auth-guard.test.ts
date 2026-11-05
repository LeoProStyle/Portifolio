import test from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from 'next-auth';
import { evaluateAdminSession, type AdminGuardResult } from '../lib/auth-guard';

const EXPIRES = '2099-01-01T00:00:00.000Z';

// Session shapes the guard must handle; cast because role/id augmentation lands in tasks.md T05.
function asSession(value: unknown): Session {
  return value as Session;
}

async function assertRejected(result: AdminGuardResult, status: number, error: string) {
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, status);
  assert.deepEqual(await result.response.json(), { error });
}

const adminSession = asSession({
  expires: EXPIRES,
  user: { id: 'admin', role: 'admin', name: 'Admin', email: 'admin@retrokey.local' }
});

test('T01 null session is rejected with 401 Unauthorized', async () => {
  await assertRejected(evaluateAdminSession(null), 401, 'Unauthorized');
});

test('T02 session without user is rejected with 401 Unauthorized', async () => {
  await assertRejected(evaluateAdminSession(asSession({ expires: EXPIRES })), 401, 'Unauthorized');
});

test('T04 session whose role is not admin is rejected with 403 Forbidden', async () => {
  const userSession = asSession({ expires: EXPIRES, user: { id: 'u1', role: 'user', name: 'U', email: 'u@x' } });
  await assertRejected(evaluateAdminSession(userSession), 403, 'Forbidden');
});

test('T04 session with empty user (no role) is rejected with 403 Forbidden', async () => {
  await assertRejected(evaluateAdminSession(asSession({ expires: EXPIRES, user: {} })), 403, 'Forbidden');
});

test('T05 admin session without id is rejected with 401 Unauthorized', async () => {
  const noId = asSession({ expires: EXPIRES, user: { role: 'admin', name: 'Admin', email: 'admin@retrokey.local' } });
  await assertRejected(evaluateAdminSession(noId), 401, 'Unauthorized');
});

test('T05 admin session passes with identity', () => {
  const result = evaluateAdminSession(adminSession);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal('response' in result, false);
  assert.equal(result.admin.id, 'admin');
  assert.equal(result.admin.name, 'Admin');
  assert.equal(result.admin.email, 'admin@retrokey.local');
  assert.equal(result.session, adminSession);
});

test('T16 guard decides without MongoDB configured', async () => {
  const previous = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  try {
    const admin = evaluateAdminSession(adminSession);
    assert.equal(admin.ok, true);
    await assertRejected(evaluateAdminSession(null), 401, 'Unauthorized');
  } finally {
    if (previous !== undefined) process.env.MONGODB_URI = previous;
  }
});
