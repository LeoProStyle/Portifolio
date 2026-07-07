import { NextResponse } from 'next/server';
import { getRooms } from '@/lib/data';

export async function GET() {
  try {
    const rooms = await getRooms();
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('[api] Failed to fetch rooms', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
