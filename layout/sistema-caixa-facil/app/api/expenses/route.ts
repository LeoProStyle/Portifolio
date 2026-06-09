import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { ExpenseModel } from "@/models/Expense";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // 1-12
  const year = url.searchParams.get("year");

  await connectToMongo();

  const filter: Record<string, unknown> = {};
  if (month && year) {
    const m = month.toString().padStart(2, "0");
    filter.date = { $regex: `^${year}-${m}-` };
  }

  const docs = await ExpenseModel.find(filter).sort({ date: 1 }).lean();
  return NextResponse.json({ ok: true, data: docs });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    date: string;
    category: string;
    description?: string;
    amount: number;
    createdBy?: string;
  };

  if (!body?.date || !body?.category || typeof body?.amount !== "number") {
    return NextResponse.json({ ok: false, error: "Campos obrigatórios" }, { status: 400 });
  }

  await connectToMongo();

  const doc = await ExpenseModel.create({
    date: body.date,
    category: body.category,
    description: body.description ?? "",
    amount: Number(body.amount),
    createdBy: body.createdBy ?? "",
  });

  return NextResponse.json({ ok: true, data: doc });
}

