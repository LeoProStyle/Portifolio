import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoomBySlug, getRooms } from '../lib/data';
import { getR2Endpoint, getR2RoomsKey, readRoomsFromR2 } from '../lib/r2';

test('returns null when Cloudflare R2 is not configured for rooms', async () => {
  const rooms = await readRoomsFromR2();

  assert.equal(rooms, null);
});

test('returns mock rooms when data is requested', async () => {
  const rooms = await getRooms();

  assert.ok(Array.isArray(rooms));
  assert.ok(rooms.length > 0);
  assert.equal(rooms[0].status, 'open');
});

test('finds a room by its slug', async () => {
  const room = await getRoomBySlug('arcade-nights');

  assert.ok(room);
  assert.equal(room?.title, 'Arcade Nights');
});

test('builds a deterministic R2 endpoint and key from env config', () => {
  assert.equal(getR2Endpoint(), '');
  assert.equal(getR2RoomsKey(), 'rooms.json');
});
