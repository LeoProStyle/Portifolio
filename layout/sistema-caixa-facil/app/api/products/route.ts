import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { ProductModel } from "@/models/Product";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const active = url.searchParams.get("active"); // "true" or undefined para mostrar todos

  await connectToMongo();

  const filter: Record<string, unknown> = {};
  if (active === "true") {
    filter.active = true;
  }

  const docs = await ProductModel.find(filter).sort({ code: 1 }).lean();
  return NextResponse.json({ ok: true, data: docs });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    code: string;
    name: string;
    category: string;
    salePrice: number;
    cost: number;
    stockCurrent?: number;
    stockMin?: number;
  };

  if (!body?.code || !body?.name || !body?.category || typeof body?.salePrice !== "number") {
    return NextResponse.json(
      { ok: false, error: "Campos obrigatórios: code, name, category, salePrice" },
      { status: 400 }
    );
  }

  await connectToMongo();

  try {
    const doc = await ProductModel.create({
      code: body.code,
      name: body.name,
      category: body.category,
      salePrice: Number(body.salePrice),
      cost: Number(body.cost ?? 0),
      stockCurrent: Number(body.stockCurrent ?? 0),
      stockMin: Number(body.stockMin ?? 0),
      active: true,
    });

    return NextResponse.json({ ok: true, data: doc });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Erro ao criar produto";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}
