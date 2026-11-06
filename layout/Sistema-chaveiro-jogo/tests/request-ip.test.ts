import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from '../lib/request-ip';

test('T09 client IP is the first trimmed x-forwarded-for value, else unknown', () => {
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' })), '1.2.3.4');
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(getClientIp(new Headers()), 'unknown');
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '' })), 'unknown');
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': ' , 10.0.0.1' })), 'unknown');
});
