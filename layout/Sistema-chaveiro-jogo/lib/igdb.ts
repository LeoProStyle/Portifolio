import { resolveEmulatorSystem, type EmulatorSystem } from '@/lib/emulator-cores';

// IGDB (api.igdb.com v4) game lookup for the admin catalog form.
// Auth is a Twitch app token (client credentials). Server-side only: the secret never reaches the browser.

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const GAMES_URL = 'https://api.igdb.com/v4/games';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';
const MIN_TERM_LENGTH = 2;
const DEFAULT_LIMIT = 10;
// Renew the token one minute before Twitch expires it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

// IGDB platform ids, checked against /v4/platforms on 2026-11-12.
const platformIdsBySystem: Record<EmulatorSystem, number[]> = {
  NES: [18],
  SNES: [19],
  'Nintendo 64': [4],
  'Game Boy': [33],
  'Game Boy Color': [22],
  'Game Boy Advance': [24],
  'Master System': [64],
  'Mega Drive / Genesis': [29],
  'Game Gear': [35],
  PlayStation: [7],
  'Arcade (FBNeo)': [52],
  'Neo Geo': [80, 79]
};

export type IgdbGame = {
  id: number;
  name: string;
  year: number | null;
  summary: string;
  genres: string[];
  coverUrl: string | null;
  thumbUrl: string | null;
};

type RawIgdbGame = {
  id: number;
  name: string;
  first_release_date?: number;
  summary?: string;
  genres?: { name?: string }[];
  cover?: { image_id?: string };
};

export type IgdbImageSize = 'thumb' | 'cover_small' | 'cover_big';

export function igdbPlatformIdsFor(system?: string | null): number[] | null {
  const resolved = resolveEmulatorSystem(system);
  return resolved ? platformIdsBySystem[resolved] : null;
}

export function igdbCoverUrl(imageId: string | undefined, size: IgdbImageSize): string | null {
  return imageId ? `${IMAGE_BASE}/t_${size}/${imageId}.jpg` : null;
}

function escapeApicalyseString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildIgdbSearchBody(term: string, platformIds: number[], limit = DEFAULT_LIMIT): string {
  return [
    `search "${escapeApicalyseString(term)}";`,
    'fields name,first_release_date,summary,genres.name,cover.image_id;',
    `where platforms = (${platformIds.join(',')});`,
    `limit ${limit};`
  ].join(' ');
}

export function mapIgdbGame(raw: RawIgdbGame): IgdbGame {
  const imageId = raw.cover?.image_id;
  return {
    id: raw.id,
    name: raw.name,
    year: raw.first_release_date ? new Date(raw.first_release_date * 1000).getUTCFullYear() : null,
    summary: raw.summary ?? '',
    genres: (raw.genres ?? []).map((genre) => genre.name).filter((name): name is string => Boolean(name)),
    coverUrl: igdbCoverUrl(imageId, 'cover_big'),
    thumbUrl: igdbCoverUrl(imageId, 'thumb')
  };
}

export type IgdbClientOptions = {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type IgdbClient = {
  searchGames: (system: string, term: string) => Promise<IgdbGame[]>;
};

export function createIgdbClient({ clientId, clientSecret, fetchImpl = fetch, now = Date.now }: IgdbClientOptions): IgdbClient {
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    });
    const response = await fetchImpl(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`IGDB token request failed: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS };
    return token.value;
  }

  async function postGames(body: string): Promise<Response> {
    return fetchImpl(GAMES_URL, {
      method: 'POST',
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${await getToken()}`, Accept: 'application/json' },
      body
    });
  }

  return {
    async searchGames(system, term) {
      const platformIds = igdbPlatformIdsFor(system);
      const trimmed = term.trim();
      if (!platformIds || trimmed.length < MIN_TERM_LENGTH) return [];

      const body = buildIgdbSearchBody(trimmed, platformIds);
      let response = await postGames(body);
      if (response.status === 401) {
        // Token revoked before its expiry: drop it and retry once with a new one.
        token = null;
        response = await postGames(body);
      }
      if (!response.ok) {
        throw new Error(`IGDB search failed: ${response.status}`);
      }
      const raw = (await response.json()) as RawIgdbGame[];
      return raw.map(mapIgdbGame);
    }
  };
}

function getEnvVar(name: string): string {
  return (process.env[name] || '').trim();
}

let defaultClient: IgdbClient | null = null;

// Returns null when IGDB_CLIENT_ID or IGDB_CLIENT_SECRET is not set.
export function getIgdbClient(): IgdbClient | null {
  if (defaultClient) return defaultClient;
  const clientId = getEnvVar('IGDB_CLIENT_ID');
  const clientSecret = getEnvVar('IGDB_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  defaultClient = createIgdbClient({ clientId, clientSecret });
  return defaultClient;
}
