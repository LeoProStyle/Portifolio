import { NextResponse } from 'next/server';
import { validateCartridge } from '@/lib/data';
import { logError, logRequest } from '@/lib/http-logger';

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

    return NextResponse.json({
      ok: true,
      cartridge: result.cartridge,
      game: result.game,
      redirectTo: `/play/${result.game.slug}`
    });
  } catch (error) {
    logError('NFC validation error', error);
    return NextResponse.json({ error: 'Failed to validate cartridge' }, { status: 500 });
  }
}
