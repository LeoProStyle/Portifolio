import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel } from "@/models/CashClosure";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // 1-12 (string)
    const year = url.searchParams.get("year");

    console.log("[GET /closures] month:", month, "year:", year);

    await connectToMongo();

    const filter: Record<string, unknown> = {};
    if (month && year) {
      // compare prefix YYYY-MM-
      const m = month.toString().padStart(2, "0");
      filter.date = { $regex: `^${year}-${m}-` };
      console.log("[GET /closures] Filter:", filter);
    }

    const docs = await CashClosureModel.find(filter).sort({ date: 1 }).lean();
    console.log("[GET /closures] Found", docs.length, "documents");

    return NextResponse.json({ ok: true, data: docs });
  } catch (error) {
    console.error("[GET /closures] Error:", error);
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
      // dinheiro removed from client; backend keeps field but will set to 0
      pix?: number;
      cartao_credito?: number;
      cartao_debito?: number;
      observacao?: string;
      createdBy?: string;
    };

    console.log("[POST /closures] Body:", body);

    if (!body?.date) {
      return NextResponse.json({ ok: false, error: "Data obrigatória" }, { status: 400 });
    }

    await connectToMongo();

    const dinheiro = 0; // dinheiro field removed from UI, keep 0 for compatibility
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

    console.log("[POST /closures] Created:", doc._id);
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    console.error("[POST /closures] Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao criar fechamento";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id;
    if (!id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });

    await connectToMongo();
    const doc = await CashClosureModel.findByIdAndDelete(id);
    if (!doc) return NextResponse.json({ ok: false, error: "Fechamento não encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /closures] Error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

