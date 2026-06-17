import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { PurchaseNoteModel } from "@/models/PurchaseNote";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const month = url.searchParams.get("month"); // 1-12
    const year = url.searchParams.get("year");
    const category = url.searchParams.get("category");
    const supplier = url.searchParams.get("supplier");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    await connectToMongo();

    if (id) {
      const doc = await PurchaseNoteModel.findById(id).lean();
      return NextResponse.json({ ok: true, data: doc });
    }

    const filter: Record<string, any> = {};
    if (month && year) {
      const m = month.toString().padStart(2, "0");
      filter.date = { $regex: `^${year}-${m}-` };
    }
    if (start || end) {
      filter.date = filter.date || {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lte = end;
    }
    if (category) filter.category = category;
    if (supplier) filter.supplier = supplier;
    filter.active = { $ne: false };

    const docs = await PurchaseNoteModel.find(filter).sort({ date: 1 }).lean();
    return NextResponse.json({ ok: true, data: docs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      date: string;
      category: string;
      description?: string;
      amount: number;
      supplier?: string;
      emitCNPJ?: string;
      emitName?: string;
      paymentMethod?: string;
      hasFiscalDocument?: boolean;
      documentNumber?: string;
      note?: string;
      active?: boolean;
      createdBy?: string;
    };

    if (!body?.date || !body?.category || typeof body?.amount !== "number") {
      return NextResponse.json({ ok: false, error: "Campos obrigatórios" }, { status: 400 });
    }

    await connectToMongo();

    const doc = await PurchaseNoteModel.create({
      date: body.date,
      category: body.category,
      description: body.description ?? "",
      amount: Number(body.amount),
      supplier: body.supplier ?? "",
      emitCNPJ: body.emitCNPJ ?? "",
      emitName: body.emitName ?? "",
      paymentMethod: body.paymentMethod ?? "",
      hasFiscalDocument: !!body.hasFiscalDocument,
      documentNumber: body.documentNumber ?? "",
      note: body.note ?? "",
      active: body.active !== false,
      createdBy: body.createdBy ?? "",
    });

    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      date?: string;
      category?: string;
      description?: string;
      amount?: number;
      supplier?: string;
      emitCNPJ?: string;
      emitName?: string;
      paymentMethod?: string;
      hasFiscalDocument?: boolean;
      documentNumber?: string;
      note?: string;
      active?: boolean;
    };

    if (!body?.id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });
    await connectToMongo();

    const update: Record<string, any> = {};
    [
      "date",
      "category",
      "description",
      "amount",
      "supplier",
      "emitCNPJ",
      "emitName",
      "paymentMethod",
      "hasFiscalDocument",
      "documentNumber",
      "note",
      "active",
    ].forEach((k) => {
      if ((body as any)[k] !== undefined) update[k] = (body as any)[k];
    });

    const doc = await PurchaseNoteModel.findByIdAndUpdate(body.id, update, { new: true }).lean();
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    if (!body?.id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });
    await connectToMongo();
    const doc = await PurchaseNoteModel.findByIdAndDelete(body.id).lean();
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
