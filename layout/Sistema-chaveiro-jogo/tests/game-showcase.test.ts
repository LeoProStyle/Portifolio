import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildShowcase,
  createCachedLookup,
  groupBySystem,
  pickFeatured,
  translateGenre,
  type CoverInfo
} from '../lib/game-showcase';
import type { Game } from '../models/game';

function game(partial: Partial<Game>): Game {
  return {
    id: partial.id ?? `game-${partial.title}`,
    title: 'Untitled',
    system: 'NES',
    slug: partial.slug ?? (partial.title ?? 'untitled').toLowerCase(),
    description: '',
    image: '',
    romPath: '',
    active: true,
    ...partial
  };
}

const info: CoverInfo = { coverUrl: 'https://images.igdb.com/x.jpg', year: 1994, genres: ['Platform', 'Adventure', 'Puzzle'] };

test('own image wins over IGDB cover; IGDB fills year and translated genres', async () => {
  const [result] = await buildShowcase([game({ title: 'Kong', image: '/own.png', system: 'SNES' })], async () => info);
  assert.equal(result.cover, '/own.png');
  assert.equal(result.year, 1994);
  assert.deepEqual(result.genres, ['Plataforma', 'Aventura']);
  assert.equal(result.system, 'SNES');
});

test('IGDB cover fills a game without image', async () => {
  const [result] = await buildShowcase([game({ title: 'Sonic', system: 'Mega Drive / Genesis' })], async () => info);
  assert.equal(result.cover, info.coverUrl);
});

test('inactive and mock games are left out; "true" text counts as active; sorted by title', async () => {
  const games = [
    game({ title: 'Zeta', active: 'true' as unknown as boolean }),
    game({ title: 'Alpha' }),
    game({ title: 'Off', active: false }),
    game({ id: 'game-1', title: 'Super Retro' })
  ];
  const result = await buildShowcase(games, null);
  assert.deepEqual(result.map((item) => item.title), ['Alpha', 'Zeta']);
  assert.equal(result[0].cover, null);
});

test('a lookup slower than the timeout leaves the game without IGDB data', async () => {
  const slow = () => new Promise<CoverInfo>((resolve) => setTimeout(() => resolve(info), 200));
  const [result] = await buildShowcase([game({ title: 'Slow' })], slow, { timeoutMs: 20 });
  assert.equal(result.cover, null);
  assert.equal(result.year, null);
});

test('cached lookup reuses hits, caches failures as misses, and expires them', async () => {
  let calls = 0;
  let time = 0;
  const lookup = createCachedLookup(
    async (_system, title) => {
      calls += 1;
      if (title === 'boom') throw new Error('down');
      return info;
    },
    { hitTtlMs: 100, missTtlMs: 10, now: () => time }
  );

  assert.deepEqual(await lookup('NES', 'Mario'), info);
  assert.deepEqual(await lookup('NES', ' mario '), info);
  assert.equal(calls, 1);

  assert.equal(await lookup('NES', 'boom'), null);
  assert.equal(await lookup('NES', 'boom'), null);
  assert.equal(calls, 2);

  time = 50;
  await lookup('NES', 'boom');
  assert.equal(calls, 3);
});

test('featured puts games with cover first; groups are ordered by size', async () => {
  const games = await buildShowcase(
    [game({ title: 'A', system: 'NES' }), game({ title: 'B', system: 'SNES', image: '/b.png' }), game({ title: 'C', system: 'NES' })],
    null
  );
  assert.equal(pickFeatured(games)[0].title, 'B');
  assert.deepEqual(groupBySystem(games).map((group) => group.system), ['NES', 'SNES']);
});

test('unknown genres pass through untranslated', () => {
  assert.equal(translateGenre('Visual Novel'), 'Visual Novel');
});
