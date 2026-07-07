import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import type { Cartridge } from '@/models/cartridge';

export async function GET() {
  try {
    const db = await getDb();
    const cartridges = await db.collection<Cartridge>('cartridges').find({}).toArray();
    return NextResponse.json(cartridges);
  } catch (error) {
    console.error('[api] Failed to fetch cartridges', error);
    return NextResponse.json({ error: 'Failed to fetch cartridges' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = await getDb();

    const newCartridge: Omit<Cartridge, 'id'> = {
      nfcId: body.nfcId,
      gameId: body.gameId,
      collectionNumber: body.collectionNumber,
      status: body.status || 'active'
    };

    const result = await db.collection<Cartridge>('cartridges').insertOne({
      ...newCartridge,
      id: `cartridge-${Date.now()}`
    } as Cartridge);

    return NextResponse.json({ id: result.insertedId, ...newCartridge }, { status: 201 });
  } catch (error) {
    console.error('[api] Failed to create cartridge', error);
    return NextResponse.json({ error: 'Failed to create cartridge' }, { status: 500 });
  }
}
