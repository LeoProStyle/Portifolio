import { NextResponse } from 'next/server';
import { getRoomBySlug } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const room = await getRoomBySlug(params.slug);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('[api] Failed to fetch room', error);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}
