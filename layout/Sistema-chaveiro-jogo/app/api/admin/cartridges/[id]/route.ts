import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import type { Cartridge } from '@/models/cartridge';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const cartridge = await db.collection<Cartridge>('cartridges').findOne({ id: params.id });

    if (!cartridge) {
      return NextResponse.json({ error: 'Cartridge not found' }, { status: 404 });
    }

    return NextResponse.json(cartridge);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cartridge' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const db = await getDb();

    const result = await db.collection<Cartridge>('cartridges').updateOne(
      { id: params.id },
      {
        $set: {
          nfcId: body.nfcId,
          gameId: body.gameId,
          collectionNumber: body.collectionNumber,
          status: body.status
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Cartridge not found' }, { status: 404 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update cartridge' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const result = await db.collection<Cartridge>('cartridges').deleteOne({ id: params.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Cartridge not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete cartridge' }, { status: 500 });
  }
}
