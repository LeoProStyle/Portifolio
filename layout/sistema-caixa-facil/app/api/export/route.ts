import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";

function escapeXmlText(value: unknown) {
  const s = String(value ?? "");
  // Evita regex com aspas ("), para não quebrar o parser.
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', '"')
    .replaceAll("'", "&apos;");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    month: string;
    year: string;
    kind: "PDF" | "Excel" | "XML";
  };

  const month = body?.month?.toString();
  const year = body?.year?.toString();
  const kind = body?.kind;

  if (!month || !year || (kind !== "PDF" && kind !== "Excel" && kind !== "XML")) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  await connectToMongo();

  const m = month.padStart(2, "0");
  const dateRegex = `^${year}-${m}-`;

  const closures = (await CashClosureModel.find({ date: { $regex: dateRegex } })
    .sort({ date: 1 })
    .lean()) as CashClosureDoc[];

  const expenses = (await ExpenseModel.find({ date: { $regex: dateRegex } })
    .sort({ date: 1 })
    .lean()) as ExpenseDoc[];

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

  if (kind === "XML") {
    const paymentXml = (name: string, value: number) =>
      `    <Pagamento tipo="${escapeXmlText(name)}">${escapeXmlText(value)}</Pagamento>`;

    const closuresXml = closures
      .map((c) => {
        return (
          `  <Fechamento data="${escapeXmlText(c.date)}">\n` +
          paymentXml("Dinheiro", c.dinheiro ?? 0) +
          "\n" +
          paymentXml("Pix", c.pix ?? 0) +
          "\n" +
          paymentXml("CartaoCredito", c.cartao_credito ?? 0) +
          "\n" +
          paymentXml("CartaoDebito", c.cartao_debito ?? 0) +
          `\n    <Total>${escapeXmlText(c.total ?? 0)}</Total>\n  </Fechamento>`
        );
      })
      .join("\n");

    const expensesXml = expenses
      .map((e) => {
        return (
          `  <Despesa data="${escapeXmlText(e.date)}">\n` +
          `    <Categoria>${escapeXmlText(e.category)}</Categoria>\n` +
          `    <Descricao>${escapeXmlText(e.description ?? "")}</Descricao>\n` +
          `    <Valor>${escapeXmlText(e.amount ?? 0)}</Valor>\n` +
          `  </Despesa>`
        );
      })
      .join("\n");

    const dailyXml = daily
      .map(
        (d) =>
          `    <ReceitaDia data="${escapeXmlText(d.date)}">${escapeXmlText(d.total)}</ReceitaDia>`,
      )
      .join("\n");

    const xml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<CaixaFacilConsolidado>\n` +
      `  <Periodo mes="${escapeXmlText(month)}" ano="${escapeXmlText(year)}" />\n` +
      `  <Resumo>\n` +
      paymentXml("Dinheiro", totalsByPayment.dinheiro) +
      "\n" +
      paymentXml("Pix", totalsByPayment.pix) +
      "\n" +
      paymentXml("CartaoCredito", totalsByPayment.cartao_credito) +
      "\n" +
      paymentXml("CartaoDebito", totalsByPayment.cartao_debito) +
      `\n    <TotalEntrada>${escapeXmlText(totalEntrada)}</TotalEntrada>\n` +
      `    <TotalDespesas>${escapeXmlText(totalDespesas)}</TotalDespesas>\n` +
      `    <LucroEstimado>${escapeXmlText(lucroEstimado)}</LucroEstimado>\n` +
      `  </Resumo>\n` +
      `  <Fechamentos>\n${closuresXml}\n  </Fechamentos>\n` +
      `  <Despesas>\n${expensesXml}\n  </Despesas>\n` +
      `  <ReceitasDiarias>\n${dailyXml}\n  </ReceitasDiarias>\n` +
      `</CaixaFacilConsolidado>`;

    return NextResponse.json({ ok: true, kind, meta: { month, year }, xml });
  }

  return NextResponse.json({
    ok: true,
    kind,
    meta: { month, year },
    payload: {
      totalEntrada,
      totalDespesas,
      lucroEstimado,
      totalsByPayment,
      closures,
      expenses,
      daily,
    },
  });
}

