import { NextResponse, type NextRequest } from 'next/server';
import { getGameBySlug } from '@/lib/data';
import { getMongoDemoStore, type DemoStartStore } from '@/lib/demo-store';
import {
  DEMO_COOLDOWN_SECONDS,
  decidePlayAccess,
  demoCookieName,
  getPlayAccessKey,
  issueDemoToken,
  issueRomTicket,
  nowInSeconds,
  passCookieName
} from '@/lib/play-access';
import { getClientIp } from '@/lib/request-ip';

// Decides how /play/[slug] runs: full (valid NFC pass cookie), demo (timer) or locked (demo used,
// cooldown running). Full and demo get a signed ROM URL; locked gets none.
// POST, because it can start a demo (sets a cookie and records the client IP).

const NO_STORE = { 'Cache-Control': 'no-store' };

async function openDemoStore(): Promise<DemoStartStore | null> {
  try {
    return await getMongoDemoStore();
  } catch (error) {
    // Without Mongo the cooldown is counted by the cookie alone.
    console.warn('[play] demo store unavailable, using the cookie only', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const key = getPlayAccessKey();
    if (!key) {
      console.error('[play] AUTH_SECRET is not set; play access refused');
      return NextResponse.json({ error: 'Play access is not configured' }, { status: 503 });
    }

    const game = await getGameBySlug(params.slug);
    if (!game || !game.active) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const slug = game.slug;
    const now = nowInSeconds();
    const passCookie = request.cookies.get(passCookieName(slug))?.value;
    const demoCookie = request.cookies.get(demoCookieName(slug))?.value;
    const romUrl = (mode: 'full' | 'demo', exp: number) =>
      `/api/rom/${encodeURIComponent(slug)}?t=${encodeURIComponent(issueRomTicket(slug, mode, exp, key))}`;

    // A valid pass decides without touching the IP store.
    const withPass = decidePlayAccess({ slug, key, nowSeconds: now, passCookie });
    if (withPass.mode === 'full') {
      return NextResponse.json(
        { mode: 'full', romUrl: romUrl('full', withPass.expiresAt), remainingSeconds: withPass.expiresAt - now },
        { headers: NO_STORE }
      );
    }

    const store = await openDemoStore();
    const ip = getClientIp(request.headers);
    let ipDemoStartedAt: number | null = null;
    if (store) {
      ipDemoStartedAt = await store.get(ip, slug).catch((error) => {
        console.warn('[play] demo store read failed', error instanceof Error ? error.message : error);
        return null;
      });
    }

    const decision = decidePlayAccess({ slug, key, nowSeconds: now, demoCookie, ipDemoStartedAt });

    if (decision.mode === 'locked') {
      return NextResponse.json({ mode: 'locked', retryInSeconds: Math.max(1, decision.retryAt - now) }, { headers: NO_STORE });
    }
    if (decision.mode !== 'demo') {
      // Not reachable without a pass cookie; kept so the response is always one of the three modes.
      return NextResponse.json({ error: 'Unexpected play access state' }, { status: 500 });
    }

    const response = NextResponse.json(
      { mode: 'demo', romUrl: romUrl('demo', decision.endsAt), remainingSeconds: decision.endsAt - now },
      { headers: NO_STORE }
    );

    if (decision.isNewDemo) {
      response.cookies.set(demoCookieName(slug), issueDemoToken(slug, decision.startedAt, key), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: DEMO_COOLDOWN_SECONDS
      });
      if (store) {
        await store.record(ip, slug, decision.startedAt).catch((error) => {
          console.warn('[play] demo store write failed', error instanceof Error ? error.message : error);
        });
      }
      console.info('[play] demo started', { slug });
    }

    return response;
  } catch (error) {
    console.error('[play] session error', error);
    return NextResponse.json({ error: 'Failed to start play session' }, { status: 500 });
  }
}
