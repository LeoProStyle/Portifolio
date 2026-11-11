import { createHash, createHmac, timingSafeEqual } from 'crypto';

// Play access (demo vs. full).
// - A cartridge validated at /api/nfc/validate gets a signed "pass" cookie: full play for PASS_SECONDS.
// - Without a pass, /play gives a DEMO_SECONDS demo; one demo per game per DEMO_COOLDOWN_SECONDS, counted
//   by a signed cookie and by client IP (see lib/demo-store.ts).
// - /api/rom/[slug] serves the ROM only with a signed "rom" ticket issued by /api/play/[slug]/session.
// Tokens are `base64url(json).base64url(hmac-sha256)`; the key is derived from AUTH_SECRET.

export const DEMO_SECONDS = 3 * 60;
export const PASS_SECONDS = 6 * 60 * 60;
export const DEMO_COOLDOWN_SECONDS = 30 * 60;

export type PassToken = { k: 'pass'; s: string; n: string; exp: number };
export type DemoToken = { k: 'demo'; s: string; iat: number; exp: number };
export type RomTicket = { k: 'rom'; s: string; m: 'full' | 'demo'; exp: number };
type AnyToken = PassToken | DemoToken | RomTicket;

const DEV_SECRET = 'retrokey-dev-secret';

/** Signing key for play tokens. Production without AUTH_SECRET gets none, and every play request is refused. */
export function getPlayAccessKey(env: { AUTH_SECRET?: string; NODE_ENV?: string } = process.env): Buffer | null {
  const secret = (env.AUTH_SECRET ?? '').trim() || (env.NODE_ENV === 'production' ? '' : DEV_SECRET);
  if (!secret) return null;
  // A separate key from the one NextAuth uses for its JWTs.
  return createHmac('sha256', secret).update('retrokey-play-access-v1').digest();
}

function sign(body: string, key: Buffer): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

export function signToken(payload: AnyToken, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, key)}`;
}

/** Returns the payload when the signature matches, the kind and slug match and `exp` is in the future. */
export function verifyToken<K extends AnyToken['k']>(
  token: string | undefined | null,
  kind: K,
  slug: string,
  key: Buffer,
  nowSeconds: number
): Extract<AnyToken, { k: K }> | null {
  if (!token || token.length > 2048) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: Partial<AnyToken>;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload?.k !== kind || payload.s !== slug) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
  return payload as Extract<AnyToken, { k: K }>;
}

/** Cookie names carry a hash of the slug, so any slug gives a valid cookie name. */
function slugKey(slug: string): string {
  return createHash('sha256').update(slug).digest('hex').slice(0, 16);
}

export function passCookieName(slug: string): string {
  return `rk_pass_${slugKey(slug)}`;
}

export function demoCookieName(slug: string): string {
  return `rk_demo_${slugKey(slug)}`;
}

export type PlayAccessDecision =
  | { mode: 'full'; expiresAt: number }
  | { mode: 'demo'; startedAt: number; endsAt: number; isNewDemo: boolean }
  | { mode: 'locked'; retryAt: number };

export interface PlayAccessInput {
  slug: string;
  key: Buffer;
  nowSeconds: number;
  passCookie?: string | null;
  demoCookie?: string | null;
  /** Start time (seconds) of the last demo this IP started for this game, if the store has one. */
  ipDemoStartedAt?: number | null;
}

/** Pure decision: a valid pass wins; otherwise the latest demo start inside the cooldown decides. */
export function decidePlayAccess(input: PlayAccessInput): PlayAccessDecision {
  const { slug, key, nowSeconds } = input;

  const pass = verifyToken(input.passCookie, 'pass', slug, key, nowSeconds);
  if (pass) return { mode: 'full', expiresAt: pass.exp };

  const cooldownStart = nowSeconds - DEMO_COOLDOWN_SECONDS;
  const demo = verifyToken(input.demoCookie, 'demo', slug, key, nowSeconds);
  const starts = [demo?.iat, input.ipDemoStartedAt].filter(
    (value): value is number => typeof value === 'number' && value > cooldownStart && value <= nowSeconds
  );

  if (starts.length === 0) {
    return { mode: 'demo', startedAt: nowSeconds, endsAt: nowSeconds + DEMO_SECONDS, isNewDemo: true };
  }

  const startedAt = Math.max(...starts);
  const endsAt = startedAt + DEMO_SECONDS;
  if (nowSeconds < endsAt) return { mode: 'demo', startedAt, endsAt, isNewDemo: false };
  return { mode: 'locked', retryAt: startedAt + DEMO_COOLDOWN_SECONDS };
}

export function issuePassToken(slug: string, nfcId: string, key: Buffer, nowSeconds: number): string {
  return signToken({ k: 'pass', s: slug, n: nfcId, exp: nowSeconds + PASS_SECONDS }, key);
}

export function issueDemoToken(slug: string, startedAt: number, key: Buffer): string {
  return signToken({ k: 'demo', s: slug, iat: startedAt, exp: startedAt + DEMO_COOLDOWN_SECONDS }, key);
}

/** ROM ticket valid until the pass ends (full) or the demo ends (demo). */
export function issueRomTicket(slug: string, mode: 'full' | 'demo', exp: number, key: Buffer): string {
  return signToken({ k: 'rom', s: slug, m: mode, exp }, key);
}

export function nowInSeconds(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}
