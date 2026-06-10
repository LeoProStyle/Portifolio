import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function escapeXmlText(value: unknown) {
  const s = String(value ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', '"')
    .replaceAll("'", "&apos;");
}

async function generatePDF(
  month: string,
  year: string,
  closures: CashClosureDoc[],
  expenses: ExpenseDoc[],
  summary: {
    totalsByPayment: Record<string, number>;
    totalEntrada: number;
    totalDespesas: number;
    lucroEstimado: number;
  }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { height } = page.getSize();

  const monthName = new Date(`${year}-${String(month).padStart(2, "0")}-01`).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  let y = height - 50;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Header
  page.drawText("CAIXA FÁCIL - Relatório Mensal", { x: 50, y, font: boldFont, size: 16, color: rgb(0, 0, 0) });
  y -= 20;
  page.drawText(`${monthName}`, { x: 50, y, font, size: 12, color: rgb(0.5, 0.5, 0.5) });
  y -= 30;

  // Resumo
  page.drawText("RESUMO DO PERÍODO", { x: 50, y, font: boldFont, size: 12 });
  y -= 15;

  const summary_data = [
    ["Dinheiro", `R$ ${(summary.totalsByPayment.dinheiro ?? 0).toFixed(2)}`],
    ["PIX", `R$ ${(summary.totalsByPayment.pix ?? 0).toFixed(2)}`],
    ["Cartão Crédito", `R$ ${(summary.totalsByPayment.cartao_credito ?? 0).toFixed(2)}`],
    ["Cartão Débito", `R$ ${(summary.totalsByPayment.cartao_debito ?? 0).toFixed(2)}`],
    ["", ""],
    ["Total Entrada", `R$ ${summary.totalEntrada.toFixed(2)}`],
    ["Total Despesas", `R$ ${summary.totalDespesas.toFixed(2)}`],
    ["Lucro Estimado", `R$ ${summary.lucroEstimado.toFixed(2)}`],
  ];

  for (const [label, value] of summary_data) {
    if (!label) {
      y -= 8;
      continue;
    }
    const isBold = ["Total Entrada", "Total Despesas", "Lucro Estimado"].includes(label);
    const f = isBold ? boldFont : font;
    page.drawText(label, { x: 50, y, font: f, size: 10 });
    page.drawText(value, { x: 350, y, font: f, size: 10 });
    y -= 12;
  }

  y -= 15;

  // Fechamentos
  if (closures.length > 0) {
    page.drawText("FECHAMENTOS DIÁRIOS", { x: 50, y, font: boldFont, size: 11 });
    y -= 12;
    for (const c of closures) {
      const date = new Date(c.date + "T00:00:00").toLocaleDateString("pt-BR");
      page.drawText(
        `${date} - Dinheiro: R$ ${(c.dinheiro ?? 0).toFixed(2)} | PIX: R$ ${(c.pix ?? 0).toFixed(2)} | Total: R$ ${(c.total ?? 0).toFixed(2)}`,
        { x: 50, y, font, size: 9 }
      );
      y -= 10;
      if (y < 50) {
        y = height - 50;
        pdfDoc.addPage([595, 842]);
      }
    }
  }

  y -= 10;

  // Despesas
  if (expenses.length > 0) {
    page.drawText("DESPESAS", { x: 50, y, font: boldFont, size: 11 });
    y -= 12;
    for (const e of expenses) {
      const date = new Date(e.date + "T00:00:00").toLocaleDateString("pt-BR");
      page.drawText(
        `${date} - ${e.category}: R$ ${(e.amount ?? 0).toFixed(2)} (${e.description || "s/ desc"})`,
        { x: 50, y, font, size: 9 }
      );
      y -= 10;
      if (y < 50) {
        y = height - 50;
        pdfDoc.addPage([595, 842]);
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function generateExcel(
  month: string,
  year: string,
  closures: CashClosureDoc[],
  expenses: ExpenseDoc[],
  summary: {
    totalsByPayment: Record<string, number>;
    totalEntrada: number;
    totalDespesas: number;
    lucroEstimado: number;
  }
): Buffer {
  const workbook = XLSX.utils.book_new();

  // Resumo
  const resumoData = [
    ["RESUMO DO PERÍODO", `${month}/${year}`],
    ["", ""],
    ["Conceito", "Valor"],
    ["Dinheiro", summary.totalsByPayment.dinheiro ?? 0],
    ["PIX", summary.totalsByPayment.pix ?? 0],
    ["Cartão Crédito", summary.totalsByPayment.cartao_credito ?? 0],
    ["Cartão Débito", summary.totalsByPayment.cartao_debito ?? 0],
    ["", ""],
    ["Total Entrada", summary.totalEntrada],
    ["Total Despesas", summary.totalDespesas],
    ["Lucro Estimado", summary.lucroEstimado],
  ];

  const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");

  // Fechamentos
  if (closures.length > 0) {
    const closuresData = [
      ["Data", "Dinheiro", "PIX", "Cartão Crédito", "Cartão Débito", "Total"],
      ...closures.map((c) => [
        new Date(c.date + "T00:00:00").toLocaleDateString("pt-BR"),
        c.dinheiro ?? 0,
        c.pix ?? 0,
        c.cartao_credito ?? 0,
        c.cartao_debito ?? 0,
        c.total ?? 0,
      ]),
    ];
    const closuresSheet = XLSX.utils.aoa_to_sheet(closuresData);
    XLSX.utils.book_append_sheet(workbook, closuresSheet, "Fechamentos");
  }

  // Despesas
  if (expenses.length > 0) {
    const expensesData = [
      ["Data", "Categoria", "Descrição", "Valor"],
      ...expenses.map((e) => [
        new Date(e.date + "T00:00:00").toLocaleDateString("pt-BR"),
        e.category,
        e.description ?? "",
        e.amount ?? 0,
      ]),
    ];
    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Despesas");
  }

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return excelBuffer;
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

  const summary = {
    totalsByPayment,
    totalEntrada,
    totalDespesas,
    lucroEstimado,
  };

  if (kind === "PDF") {
    const pdfBuffer = await generatePDF(month, year, closures, expenses, summary);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="caixa-facil-${year}-${m}.pdf"`,
      },
    });
  }

  if (kind === "Excel") {
    const excelBuffer = generateExcel(month, year, closures, expenses, summary);
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="caixa-facil-${year}-${m}.xlsx"`,
      },
    });
  }

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
      `</CaixaFacilConsolidado>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="caixa-facil-${year}-${m}.xml"`,
      },
    });
  }

  // Caso padrão: retorna JSON com resumo e dados
  return NextResponse.json({
    ok: true,
    kind: "JSON",
    meta: { month, year },
    payload: {
      totalEntrada,
      totalDespesas,
      lucroEstimado,
      totalsByPayment,
      closures,
      expenses,
    },
  });
}

