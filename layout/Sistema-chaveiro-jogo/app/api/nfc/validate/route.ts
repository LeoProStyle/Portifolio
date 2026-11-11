import { NextResponse } from 'next/server';
import { validateCartridge } from '@/lib/data';
import { logError, logRequest } from '@/lib/http-logger';
import { PASS_SECONDS, getPlayAccessKey, issuePassToken, nowInSeconds, passCookieName } from '@/lib/play-access';

export async function POST(request: Request) {
  logRequest('POST', '/api/nfc/validate');

  try {
    const body = await request.json();
    const nfcId = body?.nfcId;

    if (!nfcId) {
      logError('NFC validation missing nfcId');
      return NextResponse.json({ error: 'Missing nfcId' }, { status: 400 });
    }

    const result = await validateCartridge(nfcId);

    if (!result) {
      logError('NFC validation failed', { nfcId });
      return NextResponse.json({ error: 'Invalid or disabled cartridge' }, { status: 404 });
    }

    console.info('[api] NFC validation success', { nfcId, gameSlug: result.game.slug });

    const key = getPlayAccessKey();
    if (!key) {
      logError('NFC validation without AUTH_SECRET: no play pass issued');
      return NextResponse.json({ error: 'Play access is not configured' }, { status: 503 });
    }

    const response = NextResponse.json({
      ok: true,
      cartridge: result.cartridge,
      game: result.game,
      redirectTo: `/play/${result.game.slug}`
    });

    // Full play for this game (lib/play-access.ts); /api/play/[slug]/session reads it.
    response.cookies.set(passCookieName(result.game.slug), issuePassToken(result.game.slug, String(nfcId), key, nowInSeconds()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: PASS_SECONDS
    });

    return response;
  } catch (error) {
    logError('NFC validation error', error);
    return NextResponse.json({ error: 'Failed to validate cartridge' }, { status: 500 });
  }
}
