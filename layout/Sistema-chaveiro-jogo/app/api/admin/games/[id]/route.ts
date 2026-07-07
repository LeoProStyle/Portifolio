import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getAdminGamesStore } from '@/lib/admin-store';
import { uploadRomToR2 } from '@/lib/r2';
import type { Game } from '@/models/game';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const game = await db.collection<Game>('games').findOne({ id: params.id });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    const games = getAdminGamesStore();
    const game = games.find((item) => item.id === params.id);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let romPath: string | undefined;

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
    }

    let db;
    try {
      db = await getDb();
    } catch (error) {
      db = null;
    }

    if (db) {
      const result = await db.collection<Game>('games').updateOne(
        { id: params.id },
        {
          $set: {
            title: body.title,
            console: body.console || body.system || '',
            system: body.system || body.console || '',
            slug: body.slug,
            description: body.description,
            image: body.image,
            romPath: romPath ?? body.romPath,
            active: body.active
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      return NextResponse.json({ updated: true });
    }

    const games = getAdminGamesStore();
    const existingGame = games.find((item) => item.id === params.id);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    Object.assign(existingGame, {
      title: body.title,
      console: body.console || body.system || '',
      system: body.system || body.console || '',
      slug: body.slug,
      description: body.description,
      image: body.image,
      romPath: romPath ?? body.romPath,
      active: body.active
    });

    return NextResponse.json({ updated: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    let db;
    try {
      db = await getDb();
    } catch (error) {
      db = null;
    }

    if (db) {
      const result = await db.collection<Game>('games').deleteOne({ id: params.id });

      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      return NextResponse.json({ deleted: true });
    }

    const games = getAdminGamesStore();
    const index = games.findIndex((item) => item.id === params.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    games.splice(index, 1);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}
