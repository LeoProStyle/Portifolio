import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel } from "@/models/CashClosure";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // 1-12 (string)
  const year = url.searchParams.get("year");

  await connectToMongo();

  const filter: Record<string, unknown> = {};
  if (month && year) {
    // compare prefix YYYY-MM-
    const m = month.toString().padStart(2, "0");
    filter.date = { $regex: `^${year}-${m}-` };
  }

  const docs = await CashClosureModel.find(filter).sort({ date: 1 }).lean();
  return NextResponse.json({ ok: true, data: docs });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    date: string;
    dinheiro?: number;
    pix?: number;
    cartao_credito?: number;
    cartao_debito?: number;
    observacao?: string;
    createdBy?: string;
  };

  if (!body?.date) {
    return NextResponse.json({ ok: false, error: "Data obrigatória" }, { status: 400 });
  }

  await connectToMongo();

  const dinheiro = Number(body.dinheiro ?? 0);
  const pix = Number(body.pix ?? 0);
  const cartao_credito = Number(body.cartao_credito ?? 0);
  const cartao_debito = Number(body.cartao_debito ?? 0);

  const total = dinheiro + pix + cartao_credito + cartao_debito;

  const doc = await CashClosureModel.create({
    date: body.date,
    dinheiro,
    pix,
    cartao_credito,
    cartao_debito,
    total,
    observacao: body.observacao ?? "",
    createdBy: body.createdBy ?? "",
  });

  return NextResponse.json({ ok: true, data: doc });
}

