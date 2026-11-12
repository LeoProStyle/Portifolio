import { resolveEmulatorSystem } from '@/lib/emulator-cores';
import { getIgdbClient, type IgdbClient } from '@/lib/igdb';
import { mockGames } from '@/lib/mock-data';
import { resolvePlayTheme } from '@/lib/play-theme';
import type { Game } from '@/models/game';

// Read model for the home page: catalog games plus the cover, year and genres IGDB knows.
// The game's own image always wins; IGDB only fills what the catalog left empty.

export type ShowcaseGame = {
  slug: string;
  title: string;
  system: string;
  description: string;
  cover: string | null;
  year: number | null;
  genres: string[];
  accent: string;
  bg: string;
  frameColor: string;
};

export type CoverInfo = {
  coverUrl: string | null;
  year: number | null;
  genres: string[];
};

export type CoverLookup = (system: string, title: string) => Promise<CoverInfo | null>;

const MOCK_GAME_IDS = new Set(mockGames.map((game) => game.id));

const GENRE_PT: Record<string, string> = {
  Platform: 'Plataforma',
  Fighting: 'Luta',
  "Hack and slash/Beat 'em up": 'Beat ’em up',
  Shooter: 'Tiro',
  Adventure: 'Aventura',
  'Role-playing (RPG)': 'RPG',
  Racing: 'Corrida',
  Sport: 'Esporte',
  Puzzle: 'Quebra-cabeça',
  Arcade: 'Arcade',
  Strategy: 'Estratégia',
  Simulator: 'Simulação',
  Music: 'Música',
  Pinball: 'Pinball',
  'Turn-based strategy (TBS)': 'Estratégia por turnos',
  'Real Time Strategy (RTS)': 'Estratégia em tempo real',
  Tactical: 'Tático',
  'Quiz/Trivia': 'Quiz'
};

export function translateGenre(name: string): string {
  return GENRE_PT[name] ?? name;
}

// The admin form has stored `active` as text, so "true" also counts as active.
export function isCatalogGame(game: Game): boolean {
  return String(game.active) === 'true' && !MOCK_GAME_IDS.has(game.id);
}

export function toShowcaseGame(game: Game, info: CoverInfo | null): ShowcaseGame {
  const system = resolveEmulatorSystem(game.system || game.console) ?? (game.system || game.console || 'Console');
  const theme = resolvePlayTheme(system);
  const ownImage = (game.image || '').trim();
  return {
    slug: game.slug,
    title: game.title,
    system,
    description: (game.description || '').trim(),
    cover: ownImage || info?.coverUrl || null,
    year: info?.year ?? null,
    genres: (info?.genres ?? []).slice(0, 2).map(translateGenre),
    accent: theme.accent,
    bg: theme.bg,
    frameColor: theme.frameColor
  };
}

// Wraps a lookup with a per-process cache. Misses and failures are cached too, for a shorter time,
// so a game IGDB does not know is not searched again on every request.
export function createCachedLookup(
  lookup: CoverLookup,
  { hitTtlMs = 12 * 60 * 60 * 1000, missTtlMs = 10 * 60 * 1000, now = Date.now } = {}
): CoverLookup {
  const cache = new Map<string, { value: CoverInfo | null; expiresAt: number }>();
  return async (system, title) => {
    const key = `${system}::${title.trim().toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;

    let value: CoverInfo | null = null;
    try {
      value = await lookup(system, title);
    } catch (error) {
      console.warn('[showcase] IGDB lookup failed', { system, title, error: String(error) });
    }
    cache.set(key, { value, expiresAt: now() + (value ? hitTtlMs : missTtlMs) });
    return value;
  };
}

// Takes the result whose name matches the title exactly, otherwise the first one with a cover.
export function igdbLookup(client: IgdbClient): CoverLookup {
  return async (system, title) => {
    const results = await client.searchGames(system, title);
    const target = title.trim().toLowerCase();
    const match =
      results.find((item) => item.name.trim().toLowerCase() === target) ?? results.find((item) => item.coverUrl) ?? null;
    return match ? { coverUrl: match.coverUrl, year: match.year, genres: match.genres } : null;
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

// Enriches every game in parallel. A slow or missing lookup leaves that game without IGDB data
// instead of holding the page.
export async function buildShowcase(
  games: Game[],
  lookup: CoverLookup | null,
  { timeoutMs = 2500 } = {}
): Promise<ShowcaseGame[]> {
  const catalog = games
    .filter(isCatalogGame)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

  return Promise.all(
    catalog.map(async (game) => {
      const system = resolveEmulatorSystem(game.system || game.console);
      const info = lookup && system ? await withTimeout(lookup(system, game.title), timeoutMs, null) : null;
      return toShowcaseGame(game, info);
    })
  );
}

let defaultLookup: CoverLookup | null | undefined;

// Returns null when IGDB credentials are not configured.
export function getDefaultCoverLookup(): CoverLookup | null {
  if (defaultLookup !== undefined) return defaultLookup;
  const client = getIgdbClient();
  defaultLookup = client ? createCachedLookup(igdbLookup(client)) : null;
  return defaultLookup;
}

// Featured games come first when they have a cover, since the hero is built around the art.
export function pickFeatured(games: ShowcaseGame[], max = 5): ShowcaseGame[] {
  const withCover = games.filter((game) => game.cover);
  const without = games.filter((game) => !game.cover);
  return [...withCover, ...without].slice(0, max);
}

export function groupBySystem(games: ShowcaseGame[]): { system: string; games: ShowcaseGame[] }[] {
  const groups = new Map<string, ShowcaseGame[]>();
  for (const game of games) {
    const list = groups.get(game.system) ?? [];
    list.push(game);
    groups.set(game.system, list);
  }
  return Array.from(groups, ([system, list]) => ({ system, games: list })).sort(
    (a, b) => b.games.length - a.games.length || a.system.localeCompare(b.system)
  );
}
