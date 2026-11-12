import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIgdbSearchBody,
  createIgdbClient,
  igdbCoverUrl,
  igdbPlatformIdsFor,
  mapIgdbGame
} from '../lib/igdb';

type FetchCall = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeFetch(responses: Response[]) {
  const calls: FetchCall[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch call');
    return next;
  };
  return { calls, impl: impl as typeof fetch };
}

test('igdbPlatformIdsFor maps emulator systems and legacy aliases to IGDB platform ids', () => {
  assert.deepEqual(igdbPlatformIdsFor('SNES'), [19]);
  assert.deepEqual(igdbPlatformIdsFor('Mega Drive / Genesis'), [29]);
  assert.deepEqual(igdbPlatformIdsFor('genesis'), [29]);
  assert.deepEqual(igdbPlatformIdsFor('Neo Geo'), [80, 79]);
  assert.equal(igdbPlatformIdsFor(''), null);
  assert.equal(igdbPlatformIdsFor('Dreamcast'), null);
});

test('buildIgdbSearchBody filters by platform and escapes quotes in the term', () => {
  const body = buildIgdbSearchBody('Zelda "Link" \\ test', [19], 10);
  assert.match(body, /^search "Zelda \\"Link\\" \\\\ test";/);
  assert.match(body, /where platforms = \(19\);/);
  assert.match(body, /limit 10;/);
  assert.match(body, /fields [^;]*cover\.image_id/);
});

test('igdbCoverUrl builds the CDN url for a size', () => {
  assert.equal(igdbCoverUrl('co1abc', 'cover_big'), 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg');
  assert.equal(igdbCoverUrl(undefined, 'thumb'), null);
});

test('mapIgdbGame converts the raw record into the admin shape', () => {
  const game = mapIgdbGame({
    id: 1070,
    name: 'Super Mario World',
    first_release_date: 659318400,
    summary: 'Mario is back.',
    genres: [{ name: 'Platform' }],
    cover: { image_id: 'co8lo8' }
  });
  assert.deepEqual(game, {
    id: 1070,
    name: 'Super Mario World',
    year: 1990,
    summary: 'Mario is back.',
    genres: ['Platform'],
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8lo8.jpg',
    thumbUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/co8lo8.jpg'
  });
  assert.deepEqual(mapIgdbGame({ id: 2, name: 'X' }), {
    id: 2,
    name: 'X',
    year: null,
    summary: '',
    genres: [],
    coverUrl: null,
    thumbUrl: null
  });
});

test('searchGames requests a token once and reuses it until it expires', async () => {
  let now = 1_000_000;
  const { calls, impl } = fakeFetch([
    jsonResponse({ access_token: 'tok-1', expires_in: 3600 }),
    jsonResponse([{ id: 1, name: 'A' }]),
    jsonResponse([{ id: 2, name: 'B' }]),
    jsonResponse({ access_token: 'tok-2', expires_in: 3600 }),
    jsonResponse([{ id: 3, name: 'C' }])
  ]);
  const client = createIgdbClient({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl, now: () => now });

  assert.equal((await client.searchGames('SNES', 'a1'))[0].name, 'A');
  assert.equal((await client.searchGames('SNES', 'b1'))[0].name, 'B');
  now += 3600 * 1000;
  assert.equal((await client.searchGames('SNES', 'c1'))[0].name, 'C');

  assert.equal(calls.length, 5);
  assert.match(calls[0].url, /^https:\/\/id\.twitch\.tv\/oauth2\/token\?/);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[1].url, 'https://api.igdb.com/v4/games');
  const headers = new Headers(calls[1].init?.headers);
  assert.equal(headers.get('Client-ID'), 'cid');
  assert.equal(headers.get('Authorization'), 'Bearer tok-1');
  assert.equal(new Headers(calls[4].init?.headers).get('Authorization'), 'Bearer tok-2');
});

test('searchGames renews the token once when IGDB answers 401', async () => {
  const { calls, impl } = fakeFetch([
    jsonResponse({ access_token: 'old', expires_in: 3600 }),
    jsonResponse({ message: 'unauthorized' }, 401),
    jsonResponse({ access_token: 'new', expires_in: 3600 }),
    jsonResponse([{ id: 9, name: 'Z' }])
  ]);
  const client = createIgdbClient({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
  const games = await client.searchGames('NES', 'zz');
  assert.equal(games[0].name, 'Z');
  assert.equal(new Headers(calls[3].init?.headers).get('Authorization'), 'Bearer new');
});

test('searchGames returns [] for an unknown system or a short term without calling the network', async () => {
  const { calls, impl } = fakeFetch([]);
  const client = createIgdbClient({ clientId: 'cid', clientSecret: 'sec', fetchImpl: impl });
  assert.deepEqual(await client.searchGames('Dreamcast', 'sonic'), []);
  assert.deepEqual(await client.searchGames('SNES', ' m '), []);
  assert.equal(calls.length, 0);
});

test('searchGames throws when Twitch refuses the credentials or IGDB fails', async () => {
  const badToken = fakeFetch([jsonResponse({ message: 'invalid client secret' }, 403)]);
  const client = createIgdbClient({ clientId: 'cid', clientSecret: 'bad', fetchImpl: badToken.impl });
  await assert.rejects(client.searchGames('SNES', 'mario'), /token request failed: 403/);

  const apiDown = fakeFetch([jsonResponse({ access_token: 't', expires_in: 3600 }), jsonResponse({}, 500)]);
  const client2 = createIgdbClient({ clientId: 'cid', clientSecret: 'sec', fetchImpl: apiDown.impl });
  await assert.rejects(client2.searchGames('SNES', 'mario'), /search failed: 500/);
});
