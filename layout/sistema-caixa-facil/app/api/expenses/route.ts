import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { ExpenseModel } from "@/models/Expense";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // 1-12
    const year = url.searchParams.get("year");

    console.log("[GET /expenses] month:", month, "year:", year);

    await connectToMongo();

    const filter: Record<string, unknown> = {};
    if (month && year) {
      const m = month.toString().padStart(2, "0");
      filter.date = { $regex: `^${year}-${m}-` };
      console.log("[GET /expenses] Filter:", filter);
    }

    const docs = await ExpenseModel.find(filter).sort({ date: 1 }).lean();
    console.log("[GET /expenses] Found", docs.length, "documents");

    return NextResponse.json({ ok: true, data: docs });
  } catch (error) {
    console.error("[GET /expenses] Error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      date: string;
      category: string;
      description?: string;
      amount: number;
      createdBy?: string;
    };

    console.log("[POST /expenses] Body:", body);

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

    console.log("[POST /expenses] Created:", doc._id);
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    console.error("[POST /expenses] Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao criar despesa";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

