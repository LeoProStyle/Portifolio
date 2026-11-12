import { NextResponse, type NextRequest } from 'next/server';
import { getGameBySlug } from '@/lib/data';
import { getMongoPairStore } from '@/lib/pair-code';
import { getPlayAccessKey, nowInSeconds, passCookieName, verifyToken } from '@/lib/play-access';

// Phone side of the pairing (lib/pair-code.ts): a browser with a valid pass for this game gets a
// 6-digit code that a computer exchanges at /api/pair/redeem for the same pass.

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    const key = getPlayAccessKey();
    if (!key) {
      console.error('[pair] AUTH_SECRET is not set; pairing refused');
      return NextResponse.json({ error: 'Play access is not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const slug = typeof body?.slug === 'string' ? body.slug : '';
    const game = slug ? await getGameBySlug(slug) : null;
    if (!game || !game.active) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const now = nowInSeconds();
    const pass = verifyToken(request.cookies.get(passCookieName(game.slug))?.value, 'pass', game.slug, key, now);
    if (!pass) {
      return NextResponse.json({ error: 'Tap your cartridge first' }, { status: 401 });
    }

    const store = await getMongoPairStore();
    const created = await store.create({ slug: game.slug, nfcId: pass.n, passExp: pass.exp }, now);
    return NextResponse.json({ code: created.code, expiresInSeconds: created.expiresAt - now }, { headers: NO_STORE });
  } catch (error) {
    console.error('[pair] create failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not create a pairing code' }, { status: 500 });
  }
}
