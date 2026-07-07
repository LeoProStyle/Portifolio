import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getAdminGamesStore } from '@/lib/admin-store';
import { uploadRomToR2 } from '@/lib/r2';
import type { Game } from '@/models/game';

export async function GET() {
  try {
    const db = await getDb();
    const games = await db.collection<Game>('games').find({}).toArray();
    return NextResponse.json(games);
  } catch (error) {
    const games = getAdminGamesStore();
    return NextResponse.json(games);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let romPath = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('romFile') as File | null;
      body = Object.fromEntries(formData.entries());

      if (file && file.size > 0) {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        romPath = await uploadRomToR2(fileBuffer, String(body.slug || 'game'), file.name);
      }
    } else {
      body = await request.json();
      romPath = body.romPath || '';
    }

    let db;
    let insertedGame: Game;

    try {
      db = await getDb();
    } catch (error) {
      db = null;
    }

    const newGame: Omit<Game, 'id'> = {
      title: body.title,
      console: body.console || body.system || '',
      system: body.system || body.console || '',
      slug: body.slug,
      description: body.description,
      image: body.image || '',
      romPath: romPath || body.romPath || '',
      active: body.active ?? true
    };

    if (db) {
      const result = await db.collection<Game>('games').insertOne({
        ...newGame,
        id: `game-${Date.now()}`
      } as Game);

      insertedGame = { id: `game-${Date.now()}`, ...newGame } as Game;
      return NextResponse.json({ id: result.insertedId, ...newGame }, { status: 201 });
    }

    insertedGame = {
      ...newGame,
      id: `game-${Date.now()}`
    } as Game;
    getAdminGamesStore().push(insertedGame);

    return NextResponse.json({ id: insertedGame.id, ...newGame }, { status: 201 });
  } catch (error) {
    console.error('[api] Failed to create game', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
