import { mockCartridges, mockGames } from '@/lib/mock-data';
import { getDb } from '@/lib/mongo';
import { getRoomsFromStorage } from '@/lib/r2';
import type { Game, Room } from '@/models/game';
import type { Cartridge } from '@/models/cartridge';

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function getGames(): Promise<Game[]> {
  let dbGames: Game[] = [];

  try {
    const db = await getDb();
    dbGames = await db.collection<Game>('games').find({}).toArray();
    console.info('[data] Mongo games count', dbGames.length);
  } catch (error) {
    console.warn('MongoDB not available, falling back to mock data.', error);
  }

  const mergedGames = [...mockGames, ...dbGames];
  const gamesBySlug = new Map<string, Game>();

  for (const game of mergedGames) {
    const normalizedSlug = normalizeSlug(game.slug || game.title || '');
    if (!normalizedSlug) continue;
    gamesBySlug.set(normalizedSlug, game);
  }

  const games = Array.from(gamesBySlug.values());
  console.info('[data] Returning combined games count', games.length);
  return games;
}

export async function getCartridges(): Promise<Cartridge[]> {
  try {
    const db = await getDb();
    const cartridges = await db.collection<Cartridge>('cartridges').find({}).toArray();
    if (cartridges.length > 0) {
      return cartridges;
    }
  } catch (error) {
    console.warn('MongoDB not available, falling back to mock data.', error);
  }

  return mockCartridges;
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const games = await getGames();
  const normalizedTarget = normalizeSlug(slug);
  const match =
    games.find((game) => normalizeSlug(game.slug) === normalizedTarget) ??
    games.find((game) => normalizeSlug(game.title) === normalizedTarget) ??
    null;

  console.info('[data] getGameBySlug', { slug, normalizedTarget, count: games.length, found: Boolean(match), sample: games.slice(0, 3).map((game) => game.slug) });
  return match;
}

export async function validateCartridge(nfcId: string): Promise<{ game: Game; cartridge: Cartridge } | null> {
  const cartridges = await getCartridges();
  const cartridge = cartridges.find((item) => item.nfcId === nfcId && item.status === 'active');

  if (!cartridge) {
    return null;
  }

  const games = await getGames();
  const game = games.find((item) => item.id === cartridge.gameId && item.active);

  if (!game) {
    return null;
  }

  return { cartridge, game };
}

export async function getRooms(): Promise<Room[]> {
  try {
    return await getRoomsFromStorage();
  } catch (error) {
    console.warn('Room storage unavailable, falling back to mock rooms.', error);
  }

  return getRoomsFromStorage();
}

export async function getRoomBySlug(slug: string): Promise<Room | null> {
  const rooms = await getRooms();
  return rooms.find((room) => room.slug === slug) ?? null;
}
