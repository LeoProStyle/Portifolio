import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getIgdbClient } from '@/lib/igdb';

// GET /api/admin/igdb/search?system=SNES&q=mario -> IgdbGame[] for the admin game form.
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const system = searchParams.get('system') || '';
    const term = searchParams.get('q') || '';
    if (!system || !term.trim()) {
      return NextResponse.json({ error: 'system and q are required' }, { status: 400 });
    }

    const client = getIgdbClient();
    if (!client) {
      return NextResponse.json({ error: 'IGDB is not configured' }, { status: 503 });
    }

    const games = await client.searchGames(system, term);
    return NextResponse.json(games);
  } catch (error) {
    console.error('[igdb] search failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'IGDB search failed' }, { status: 502 });
  }
}
