import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel } from "@/models/CashClosure";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const month = url.searchParams.get("month"); // 1-12 (string)
    const year = url.searchParams.get("year");

    await connectToMongo();

    // Diagnostic status - returns DB/model info and sample documents
    if (status === "1") {
      try {
        const total = await CashClosureModel.countDocuments();
        const missing = await CashClosureModel.countDocuments({ maquininha: { $exists: false } });
        const nullish = await CashClosureModel.countDocuments({ maquininha: null });
        const sampleMissing = await CashClosureModel.findOne({ maquininha: { $exists: false } }).lean();
        const sampleWith = await CashClosureModel.findOne({ maquininha: { $exists: true } }).lean();
        return NextResponse.json({ ok: true, status: { total, missing, nullish, sampleMissing, sampleWith } });
      } catch (err) {
        console.error('[GET /closures status] error:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
      }
    }

    if (id) {
      const doc = await CashClosureModel.findById(id).lean();
      return NextResponse.json({ ok: true, data: doc });
    }

    const filter: Record<string, unknown> = {};
    if (month && year) {
      // compare prefix YYYY-MM-
      const m = month.toString().padStart(2, "0");
      filter.date = { $regex: `^${year}-${m}-` };
    }

    const docs = await CashClosureModel.find(filter).sort({ date: 1 }).lean();
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
      pix?: number | string;
      cartao_credito?: number | string;
      cartao_debito?: number | string;
      maquininha?: number | string;
      observacao?: string;
      createdBy?: string;
    };


    if (!body?.date) {
      return NextResponse.json({ ok: false, error: "Data obrigatória" }, { status: 400 });
    }

    await connectToMongo();
    const parseNumberString = (v: any) => {
      if (typeof v === "number") return v;
      if (!v) return 0;
      const cleaned = String(v).replace(/[^0-9.,-]/g, "").trim();
      if (!cleaned) return 0;
      if (cleaned.includes(",")) {
        const normalized = cleaned.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
      }
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const dinheiro = 0; // dinheiro field removed from UI, keep 0 for compatibility
    const pix = parseNumberString(body.pix ?? 0);
    const cartao_credito = parseNumberString(body.cartao_credito ?? 0);
    const cartao_debito = parseNumberString(body.cartao_debito ?? 0);
    const maquininha = parseNumberString(body.maquininha ?? 0);

    const total = dinheiro + pix + cartao_credito + cartao_debito + maquininha;

    const doc = await CashClosureModel.create({
      date: body.date,
      dinheiro,
      pix,
      cartao_credito,
      cartao_debito,
      maquininha,
      total,
      observacao: body.observacao ?? "",
      createdBy: body.createdBy ?? "",
    });

    // Ensure maquininha persisted: if schema/runtime issue prevented the field
    // from being stored, force an update with $set.
    if ((doc as any).maquininha === undefined && maquininha !== undefined) {
      await CashClosureModel.collection.updateOne({ _id: doc._id }, { $set: { maquininha, total } });
      const forced = await CashClosureModel.findById(doc._id).lean();
      return NextResponse.json({ ok: true, data: forced });
    }

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

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      date?: string;
      pix?: number | string;
      cartao_credito?: number | string;
      cartao_debito?: number | string;
      maquininha?: number | string;
      observacao?: string;
    };

    if (!body?.id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });
    await connectToMongo();

    const parseNumberString = (v: any) => {
      if (typeof v === "number") return v;
      if (!v) return 0;
      const cleaned = String(v).replace(/[^0-9.,-]/g, "").trim();
      if (!cleaned) return 0;
      if (cleaned.includes(",")) {
        const normalized = cleaned.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
      }
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const update: Record<string, any> = {};
    ["date", "pix", "cartao_credito", "cartao_debito", "maquininha", "observacao"].forEach((k) => {
      if ((body as any)[k] !== undefined) {
        if (["pix", "cartao_credito", "cartao_debito", "maquininha"].includes(k)) {
          update[k] = parseNumberString((body as any)[k]);
        } else {
          update[k] = (body as any)[k];
        }
      }
    });

    // Recalculate total if any payment fields provided
    if (update.pix !== undefined || update.cartao_credito !== undefined || update.cartao_debito !== undefined || update.maquininha !== undefined) {
      const existing = await CashClosureModel.findById(body.id).lean();
      if (!existing) return NextResponse.json({ ok: false, error: "Fechamento não encontrado" }, { status: 404 });
      const dinheiro = existing.dinheiro ?? 0;
      const pix = update.pix !== undefined ? Number(update.pix) : Number(existing.pix ?? 0);
      const cartao_credito = update.cartao_credito !== undefined ? Number(update.cartao_credito) : Number(existing.cartao_credito ?? 0);
      const cartao_debito = update.cartao_debito !== undefined ? Number(update.cartao_debito) : Number(existing.cartao_debito ?? 0);
      const maquininha = update.maquininha !== undefined ? Number(update.maquininha) : Number(existing.maquininha ?? 0);
      update.total = dinheiro + pix + cartao_credito + cartao_debito + maquininha;
    }

    const doc = await CashClosureModel.findByIdAndUpdate(body.id, { $set: update }, { returnDocument: 'after' }).lean();
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    console.error("[PATCH /closures] Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
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

// NOTE: a lightweight migration helper (for local use) could be run to populate
// the `maquininha` field on existing documents. Example script is available at
// `scripts/migrate-add-maquininha.js` in the project root.

