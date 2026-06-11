import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";
import { PurchaseNoteModel, type PurchaseNoteDoc } from "@/models/PurchaseNote";
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
  purchaseNotes: PurchaseNoteDoc[],
  summary: {
    totalsByPayment: Record<string, number>;
    totalEntrada: number;
    totalDespesas: number;
    lucroEstimado: number;
  }
): Buffer {
  const workbook = XLSX.utils.book_new();

  // Nota: o usuário solicitou remover a aba Resumo — permanecem apenas as abas geradas conforme dados retornados (Fechamentos/Despesas/Notas)

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
    // total geral dos fechamentos (somente os itens retornados)
    const totalFechamentos = closures.reduce((s: number, c) => s + (c.total ?? 0), 0);
    closuresData.push(["", "", "", "", "Total Geral", totalFechamentos]);
    const closuresSheet = XLSX.utils.aoa_to_sheet(closuresData);
    // formatar colunas de valores como moeda (colunas B..F e Total na coluna F)
    if (closuresSheet["!ref"]) {
      const range = XLSX.utils.decode_range(closuresSheet["!ref"]);
      for (let R = 1; R <= range.e.r; ++R) {
        // columns: 1=Dinheiro,2=PIX,3=Cartão Crédito,4=Cartão Débito,5=Total
        for (const C of [1, 2, 3, 4, 5]) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = closuresSheet[cellAddress];
          if (cell && (typeof cell.v === "number" || !isNaN(Number(cell.v)))) {
            cell.t = "n";
            cell.z = "R$ #,##0.00";
            cell.v = Number(cell.v);
          }
        }
      }
    }
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
    // total das despesas (somente os itens retornados)
    const totalDespesasSheet = expenses.reduce((s: number, e) => s + (e.amount ?? 0), 0);
    expensesData.push(["", "", "TOTAL", totalDespesasSheet]);
    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
    // formatar coluna Valor (coluna D / index 3) como moeda
    if (expensesSheet["!ref"]) {
      const range = XLSX.utils.decode_range(expensesSheet["!ref"]);
      for (let R = 1; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: 3 });
        const cell = expensesSheet[cellAddress];
        if (cell && (typeof cell.v === "number" || !isNaN(Number(cell.v)))) {
          cell.t = "n";
          cell.z = "R$ #,##0.00";
          cell.v = Number(cell.v);
        }
      }
    }
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Despesas");
  }

  // Notas de compras
  if (purchaseNotes.length > 0) {
    const notesData = [
      ["Data", "Categoria", "Descrição", "Fornecedor", "Forma de Pagamento", "Documento Fiscal", "Número Documento", "Observação", "Valor"],
      ...purchaseNotes.map((n) => [
        new Date(n.date + "T00:00:00").toLocaleDateString("pt-BR"),
        n.category ?? "",
        n.description ?? "",
        n.supplier ?? "",
        n.paymentMethod ?? "",
        n.hasFiscalDocument ? "Sim" : "Não",
        n.documentNumber ?? "",
        n.note ?? "",
        n.amount ?? 0,
      ]),
    ];
    // total das notas de compras (somente os itens retornados)
    const totalNotasSheet = purchaseNotes.reduce((s: number, n) => s + (n.amount ?? 0), 0);
    notesData.push(["", "", "", "", "", "", "", "TOTAL NOTAS", totalNotasSheet]);
    const notesSheet = XLSX.utils.aoa_to_sheet(notesData);
    // formatar coluna Valor (coluna I / index 8) como moeda
    if (notesSheet["!ref"]) {
      const range = XLSX.utils.decode_range(notesSheet["!ref"]);
      for (let R = 1; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: 8 });
        const cell = notesSheet[cellAddress];
        if (cell && (typeof cell.v === "number" || !isNaN(Number(cell.v)))) {
          cell.t = "n";
          cell.z = "R$ #,##0.00";
          cell.v = Number(cell.v);
        }
      }
    }
    XLSX.utils.book_append_sheet(workbook, notesSheet, "Notas de compras");
  }

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return excelBuffer;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    month: string;
    year: string;
    kind: "PDF" | "Excel" | "XML";
    types?: string[]; // e.g. ["fechamentos","despesas"]
    // for XML only: map of selected ids per type, e.g. { despesas: ["id1"], notas: ["id2"] }
    selected?: Record<string, string[]>;
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

  const requestedTypes = body.types;
  const includeClosures = !requestedTypes || requestedTypes.length === 0 || requestedTypes.includes("fechamentos");
  const includeExpenses = !requestedTypes || requestedTypes.length === 0 || requestedTypes.includes("despesas");
  const includePurchaseNotes = !requestedTypes || requestedTypes.length === 0 || requestedTypes.includes("notas");

  const selected = (body as any).selected as Record<string, string[]> | undefined;

  // honor explicit selection for XML: if selected ids are provided for a type, fetch only those
  const closures = selected?.fechamentos && selected.fechamentos.length > 0
    ? ((await CashClosureModel.find({ _id: { $in: selected.fechamentos } }).sort({ date: 1 }).lean()) as CashClosureDoc[])
    : includeClosures
    ? ((await CashClosureModel.find({ date: { $regex: dateRegex } }).sort({ date: 1 }).lean()) as CashClosureDoc[])
    : ([] as CashClosureDoc[]);

  const expenses = selected?.despesas && selected.despesas.length > 0
    ? ((await ExpenseModel.find({ _id: { $in: selected.despesas } }).sort({ date: 1 }).lean()) as ExpenseDoc[])
    : includeExpenses
    ? ((await ExpenseModel.find({ date: { $regex: dateRegex } }).sort({ date: 1 }).lean()) as ExpenseDoc[])
    : ([] as ExpenseDoc[]);

  const purchaseNotes = selected?.notas && selected.notas.length > 0
    ? ((await PurchaseNoteModel.find({ _id: { $in: selected.notas } }).sort({ date: 1 }).lean()) as PurchaseNoteDoc[])
    : includePurchaseNotes
    ? ((await PurchaseNoteModel.find({ date: { $regex: dateRegex } }).sort({ date: 1 }).lean()) as PurchaseNoteDoc[])
    : ([] as PurchaseNoteDoc[]);

  const totalsByPayment = {
    dinheiro: includeClosures ? closures.reduce((s: number, c: CashClosureDoc) => s + (c.dinheiro ?? 0), 0) : 0,
    pix: includeClosures ? closures.reduce((s: number, c: CashClosureDoc) => s + (c.pix ?? 0), 0) : 0,
    cartao_credito: includeClosures ? closures.reduce((s: number, c: CashClosureDoc) => s + (c.cartao_credito ?? 0), 0) : 0,
    cartao_debito: includeClosures ? closures.reduce((s: number, c: CashClosureDoc) => s + (c.cartao_debito ?? 0), 0) : 0,
  };

  const totalEntrada = includeClosures ? closures.reduce((s: number, c: CashClosureDoc) => s + (c.total ?? 0), 0) : 0;
  const totalDespesas = includeExpenses ? expenses.reduce((s: number, e: ExpenseDoc) => s + (e.amount ?? 0), 0) : 0;
  const lucroEstimado = totalEntrada - totalDespesas;

  const totalNotas = purchaseNotes.reduce((s: number, n: PurchaseNoteDoc) => s + (n.amount ?? 0), 0);

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
    const excelBuffer = generateExcel(month, year, closures, expenses, purchaseNotes, summary);
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

    const purchaseNotesXml = purchaseNotes
      .map((n) => {
        return (
          `  <Nota data="${escapeXmlText(n.date)}">\n` +
          `    <Categoria>${escapeXmlText(n.category)}</Categoria>\n` +
          `    <Descricao>${escapeXmlText(n.description ?? "")}</Descricao>\n` +
          `    <Valor>${escapeXmlText(n.amount ?? 0)}</Valor>\n` +
          `    <Fornecedor>${escapeXmlText(n.supplier ?? "")}</Fornecedor>\n` +
          `    <FormaPagamento>${escapeXmlText(n.paymentMethod ?? "")}</FormaPagamento>\n` +
          `    <TemDocumentoFiscal>${escapeXmlText(n.hasFiscalDocument ?? false)}</TemDocumentoFiscal>\n` +
          `    <NumeroDocumento>${escapeXmlText(n.documentNumber ?? "")}</NumeroDocumento>\n` +
          `    <Observacao>${escapeXmlText(n.note ?? "")}</Observacao>\n` +
          `  </Nota>`
        );
      })
      .join("\n");

    // Build XML sections only for the requested types (or for defaults when none specified)
    const includeResumo = includeClosures || includeExpenses; // resumo only makes sense when closures or expenses included

    const parts: string[] = [];
    parts.push(`<?xml version="1.0" encoding="utf-8"?>`);
    parts.push(`<CaixaFacilConsolidado>`);
    parts.push(`  <Periodo mes="${escapeXmlText(month)}" ano="${escapeXmlText(year)}" />`);

    if (includeResumo) {
      parts.push(`  <Resumo>`);
      parts.push(paymentXml("Dinheiro", totalsByPayment.dinheiro));
      parts.push(paymentXml("Pix", totalsByPayment.pix));
      parts.push(paymentXml("CartaoCredito", totalsByPayment.cartao_credito));
      parts.push(paymentXml("CartaoDebito", totalsByPayment.cartao_debito));
      parts.push(`    <TotalEntrada>${escapeXmlText(totalEntrada)}</TotalEntrada>`);
      parts.push(`    <TotalDespesas>${escapeXmlText(totalDespesas)}</TotalDespesas>`);
      parts.push(`    <LucroEstimado>${escapeXmlText(lucroEstimado)}</LucroEstimado>`);
      parts.push(`  </Resumo>`);
    }

    if (includeClosures) {
      parts.push(`  <Fechamentos>`);
      parts.push(closuresXml);
      parts.push(`  </Fechamentos>`);
    }

    if (includeExpenses) {
      parts.push(`  <Despesas>`);
      parts.push(expensesXml);
      parts.push(`  </Despesas>`);
    }

    if (includePurchaseNotes) {
      parts.push(`  <NotasCompras>`);
      parts.push(purchaseNotesXml);
      parts.push(`    <TotalNotas>${escapeXmlText(totalNotas)}</TotalNotas>`);
      parts.push(`  </NotasCompras>`);
    }

    parts.push(`</CaixaFacilConsolidado>`);

    const xml = parts.join("\n");

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

