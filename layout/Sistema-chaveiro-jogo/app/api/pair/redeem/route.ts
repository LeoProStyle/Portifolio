import { NextResponse, type NextRequest } from 'next/server';
import { getMongoAttemptStore } from '@/lib/login-throttle';
import { getMongoPairStore, normalizePairCode, registerPairAttempt } from '@/lib/pair-code';
import { getPlayAccessKey, nowInSeconds, passCookieName, signToken } from '@/lib/play-access';
import { getClientIp } from '@/lib/request-ip';

// Computer side of the pairing (lib/pair-code.ts): a valid code becomes the same pass cookie the
// phone holds, with the same expiry. Every attempt counts toward the per-IP limit.

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    const key = getPlayAccessKey();
    if (!key) {
      console.error('[pair] AUTH_SECRET is not set; pairing refused');
      return NextResponse.json({ error: 'Play access is not configured' }, { status: 503 });
    }

    const attempt = await registerPairAttempt(await getMongoAttemptStore(), getClientIp(request.headers), new Date());
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts', retryAfterSeconds: attempt.retryAfterSeconds },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(attempt.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => null);
    const code = normalizePairCode(body?.code);
    if (!code) {
      return NextResponse.json({ error: 'The code has 6 digits' }, { status: 400 });
    }

    const now = nowInSeconds();
    const grant = await (await getMongoPairStore()).redeem(code, now);
    if (!grant || grant.passExp <= now) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, redirectTo: `/play/${encodeURIComponent(grant.slug)}` }, { headers: NO_STORE });
    response.cookies.set(passCookieName(grant.slug), signToken({ k: 'pass', s: grant.slug, n: grant.nfcId, exp: grant.passExp }, key), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: grant.passExp - now
    });
    return response;
  } catch (error) {
    console.error('[pair] redeem failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not check the code' }, { status: 500 });
  }
}
