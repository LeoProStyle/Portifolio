import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_LOGIN_URL, getAdminAuthStatus } from '../lib/admin-api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('T08 helper maps 401 to 401', () => {
  assert.equal(getAdminAuthStatus(jsonResponse(401, { error: 'Unauthorized' })), 401);
});

test('T08 helper maps 403 to 403', () => {
  assert.equal(getAdminAuthStatus(jsonResponse(403, { error: 'Forbidden' })), 403);
});

test('T08 helper decides by status, not by body text', () => {
  assert.equal(getAdminAuthStatus(jsonResponse(401, { error: 'qualquer texto' })), 401);
});

test('T09 helper returns null for 200, 404 and 500', () => {
  assert.equal(getAdminAuthStatus(jsonResponse(200, [])), null);
  assert.equal(getAdminAuthStatus(jsonResponse(404, { error: 'Not found' })), null);
  assert.equal(getAdminAuthStatus(jsonResponse(500, { error: 'Unauthorized' })), null);
});

test('T09 ADMIN_LOGIN_URL points to login with callback to /admin', () => {
  assert.equal(ADMIN_LOGIN_URL, '/login?callbackUrl=/admin');
});
