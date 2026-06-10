import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");

    console.log("[GET /dashboard] month:", month, "year:", year);

    await connectToMongo();

    const m = month ? String(month).padStart(2, "0") : String(new Date().getMonth() + 1).padStart(2, "0");
    const y = year || String(new Date().getFullYear());
    const dateRegex = `^${y}-${m}-`;

    const closures = (await CashClosureModel.find({ date: { $regex: dateRegex } })
      .sort({ date: 1 })
      .lean()) as CashClosureDoc[];

    const expenses = (await ExpenseModel.find({ date: { $regex: dateRegex } })
      .sort({ date: 1 })
      .lean()) as ExpenseDoc[];

    console.log(`[GET /dashboard] Found ${closures.length} closures and ${expenses.length} expenses`);

    const totalsByPayment = {
      dinheiro: closures.reduce((s: number, c: CashClosureDoc) => s + (c.dinheiro ?? 0), 0),
      pix: closures.reduce((s: number, c: CashClosureDoc) => s + (c.pix ?? 0), 0),
      cartao_credito: closures.reduce((s: number, c: CashClosureDoc) => s + (c.cartao_credito ?? 0), 0),
      cartao_debito: closures.reduce((s: number, c: CashClosureDoc) => s + (c.cartao_debito ?? 0), 0),
    };

    const totalEntrada = closures.reduce((s: number, c: CashClosureDoc) => s + (c.total ?? 0), 0);
    const totalDespesas = expenses.reduce((s: number, e: ExpenseDoc) => s + (e.amount ?? 0), 0);
    const lucroEstimado = totalEntrada - totalDespesas;

    const daily = closures.map((c: CashClosureDoc) => ({
      date: c.date,
      total: c.total ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      payload: {
        totalEntrada,
        totalDespesas,
        lucroEstimado,
        totalsByPayment,
        closures: daily,
      },
    });
  } catch (error) {
    console.error("[GET /dashboard] Error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
