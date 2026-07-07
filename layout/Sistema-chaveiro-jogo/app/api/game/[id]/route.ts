import { NextResponse } from 'next/server';
import { getGameBySlug } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const game = await getGameBySlug(params.id);

    if (!game) {
      console.error('[api] Game lookup failed', { slug: params.id });
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('[api] Game lookup error', error);
    return NextResponse.json({ error: 'Failed to load game' }, { status: 500 });
  }
}
