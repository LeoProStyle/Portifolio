import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    console.info('[logs] client log:', body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[logs] failed to receive client log', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
