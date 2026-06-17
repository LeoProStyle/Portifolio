import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";
import { PurchaseNoteModel, type PurchaseNoteDoc } from "@/models/PurchaseNote";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import Yazl from "yazl";

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

    // If the export is only purchase notes, either produce a consolidated NF-e XML
    // or, when `individual: true` is requested, produce a ZIP with one NF-e file per note.
    if (includePurchaseNotes && !includeClosures && !includeExpenses) {
      const individual = (body as any)?.individual === true;

      const buildNfeProc = (n: PurchaseNoteDoc, idx: number) => {
        const id = `NFe${Math.floor(Math.random() * 1e12)}`;
        const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
        const nNF = escapeXmlText(n.documentNumber ?? String(idx + 1));
        const dh = `${escapeXmlText(n.date)}T00:00:00-03:00`;

        const EMIT_CNPJ = process.env.FISCAL_CNPJ ?? "00000000000000";
        const EMIT_xNome = process.env.FISCAL_NAME ?? "Empresa Emitente";
        const EMIT_UF = process.env.FISCAL_UF ?? "SP";
        const EMIT_mun = process.env.FISCAL_MUN ?? "3513504";
        const EMIT_xMun = process.env.FISCAL_MUN_NAME ?? "";
        const EMIT_IE = process.env.FISCAL_IE ?? "";
        const EMIT_xLgr = process.env.FISCAL_LOGRADOURO ?? "Endereço Emitente";
        const EMIT_nro = process.env.FISCAL_NUM ?? "SN";
        const EMIT_xBairro = process.env.FISCAL_BAIRRO ?? "Bairro";
        const EMIT_CEP = process.env.FISCAL_CEP ?? "00000000";
        const EMIT_cPais = process.env.FISCAL_CPais ?? "1058";
        const EMIT_xPais = process.env.FISCAL_Pais ?? "Brasil";
        const EMIT_fone = process.env.FISCAL_FONE ?? "";

        const DEST_CPF_CNPJ = n.documentNumber ?? "";
        const DEST_xNome = n.supplier ?? n.description ?? "Consumidor";
        const DEST_xLgr = n.supplierAddress ?? "";
        const DEST_nro = n.supplierNumber ?? "SN";
        const DEST_xBairro = n.supplierNeighborhood ?? "";
        const DEST_cMun = n.supplierMun ?? "";
        const DEST_xMun = n.supplierCity ?? "";
        const DEST_UF = n.supplierUF ?? "";
        const DEST_CEP = n.supplierCEP ?? "";

        const chNFe = `${String(Math.floor(Math.random() * 9e43)).padStart(44, "0")}`.slice(0, 44);
        const protDh = new Date().toISOString().replace(/\.\d+Z$/, "-03:00");
        const nProt = String(Math.floor(Math.random() * 1e15));

        // Build a fuller NFe structure similar to example (placeholders for signature)
        return (
          `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
          `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
          `<infNFe Id="${id}" versao="4.00">` +
          `<ide>` +
          `<cUF>35</cUF>` +
          `<cNF>${cNF}</cNF>` +
          `<natOp>Venda de mercadoria a nao contribuinte</natOp>` +
          `<mod>55</mod>` +
          `<serie>1</serie>` +
          `<nNF>${nNF}</nNF>` +
          `<dhEmi>${dh}</dhEmi>` +
          `<dhSaiEnt>${dh}</dhSaiEnt>` +
          `<tpNF>1</tpNF>` +
          `<idDest>2</idDest>` +
          `<cMunFG>${escapeXmlText(EMIT_mun)}</cMunFG>` +
          `<tpImp>1</tpImp>` +
          `<tpEmis>1</tpEmis>` +
          `<cDV>0</cDV>` +
          `<tpAmb>1</tpAmb>` +
          `<finNFe>1</finNFe>` +
          `<indFinal>1</indFinal>` +
          `<indPres>0</indPres>` +
          `<procEmi>0</procEmi>` +
          `<verProc>caixa-facil-1.0</verProc>` +
          `</ide>` +
          `<emit>` +
          `<CNPJ>${escapeXmlText(EMIT_CNPJ)}</CNPJ>` +
          `<xNome>${escapeXmlText(EMIT_xNome)}</xNome>` +
          `<enderEmit>` +
          `<xLgr>${escapeXmlText(EMIT_xLgr)}</xLgr>` +
          `<nro>${escapeXmlText(EMIT_nro)}</nro>` +
          `<xBairro>${escapeXmlText(EMIT_xBairro)}</xBairro>` +
          `<cMun>${escapeXmlText(EMIT_mun)}</cMun>` +
          `<xMun>${escapeXmlText(EMIT_xMun ?? "")}</xMun>` +
          `<UF>${escapeXmlText(EMIT_UF)}</UF>` +
          `<CEP>${escapeXmlText(EMIT_CEP)}</CEP>` +
          `<cPais>${escapeXmlText(EMIT_cPais)}</cPais>` +
          `<xPais>${escapeXmlText(EMIT_xPais)}</xPais>` +
          `<fone>${escapeXmlText(EMIT_fone)}</fone>` +
          `</enderEmit>` +
          `<IE>${escapeXmlText(EMIT_IE)}</IE>` +
          `<CRT>3</CRT>` +
          `</emit>` +
          `<dest>` +
          `${DEST_CPF_CNPJ && DEST_CPF_CNPJ.length === 11 ? `<CPF>${escapeXmlText(DEST_CPF_CNPJ)}</CPF>` : `<CNPJ>${escapeXmlText(DEST_CPF_CNPJ)}</CNPJ>`}` +
          `<xNome>${escapeXmlText(DEST_xNome)}</xNome>` +
          `<enderDest>` +
          `<xLgr>${escapeXmlText(DEST_xLgr)}</xLgr>` +
          `<nro>${escapeXmlText(DEST_nro)}</nro>` +
          `<xBairro>${escapeXmlText(DEST_xBairro)}</xBairro>` +
          `<cMun>${escapeXmlText(DEST_cMun)}</cMun>` +
          `<xMun>${escapeXmlText(DEST_xMun)}</xMun>` +
          `<UF>${escapeXmlText(DEST_UF)}</UF>` +
          `<CEP>${escapeXmlText(DEST_CEP)}</CEP>` +
          `<cPais>1058</cPais>` +
          `<xPais>Brasil</xPais>` +
          `</enderDest>` +
          `<indIEDest>9</indIEDest>` +
          `</dest>` +
          `<det nItem="1">` +
          `<prod>` +
          `<cProd>ITEM${idx + 1}</cProd>` +
          `<cEAN>SEM GTIN</cEAN>` +
          `<xProd>${escapeXmlText(n.description ?? n.category ?? "Item")}</xProd>` +
          `<NCM>${escapeXmlText(n.ncm ?? "")}</NCM>` +
          `<CEST>${escapeXmlText(n.cest ?? "")}</CEST>` +
          `<indEscala>N</indEscala>` +
          `<CFOP>6108</CFOP>` +
          `<uCom>UN</uCom>` +
          `<qCom>1.0000</qCom>` +
          `<vUnCom>${escapeXmlText(n.amount ?? 0)}</vUnCom>` +
          `<vProd>${escapeXmlText(n.amount ?? 0)}</vProd>` +
          `<cEANTrib>SEM GTIN</cEANTrib>` +
          `<uTrib>UN</uTrib>` +
          `<qTrib>1.0000</qTrib>` +
          `<vUnTrib>${escapeXmlText(n.amount ?? 0)}</vUnTrib>` +
          `<indTot>1</indTot>` +
          `</prod>` +
          `<imposto>` +
          `<vTotTrib>0.00</vTotTrib>` +
          `<ICMS>` +
          `<ICMS00><orig>0</orig><CST>00</CST><modBC>0</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00>` +
          `</ICMS>` +
          `<PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>` +
          `<COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>` +
          `<ICMSUFDest>` +
          `<vBCUFDest>0.00</vBCUFDest><vBCFCPUFDest>0.00</vBCFCPUFDest><pFCPUFDest>0.0000</pFCPUFDest><pICMSUFDest>0.0000</pICMSUFDest><pICMSInter>0.0000</pICMSInter><pICMSInterPart>0.0000</pICMSInterPart><vFCPUFDest>0.00</vFCPUFDest><vICMSUFDest>0.00</vICMSUFDest><vICMSUFRemet>0.00</vICMSUFRemet>` +
          `</ICMSUFDest>` +
          `</imposto>` +
          `</det>` +
          `<total>` +
          `<ICMSTot>` +
          `<vProd>${escapeXmlText(n.amount ?? 0)}</vProd>` +
          `<vFrete>0.00</vFrete><vSeg>0.00<\/vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${escapeXmlText(n.amount ?? 0)}</vNF><vTotTrib>0.00</vTotTrib>` +
          `</ICMSTot>` +
          `</total>` +
          `<transp><modFrete>0</modFrete><vol><pesoL>0.000</pesoL><pesoB>0.000</pesoB></vol></transp>` +
          `<cobr><fat><nFat>${nNF}</nFat><vOrig>${escapeXmlText(n.amount ?? 0)}</vOrig><vDesc>0</vDesc><vLiq>${escapeXmlText(n.amount ?? 0)}</vLiq></fat></cobr>` +
          `<pag><detPag><indPag>0</indPag><tPag>15</tPag><vPag>${escapeXmlText(n.amount ?? 0)}</vPag></detPag></pag>` +
          `<infAdic><infCpl>${escapeXmlText(n.note ?? `Total aproximado de tributos: R$ 0,00`)}</infCpl></infAdic>` +
          `<infRespTec><CNPJ>00000000000000</CNPJ><xContato>CaixaFacil</xContato><email>fiscal@example.com</email><fone></fone></infRespTec>` +
          `</infNFe>` +
          // Placeholder Signature block (structure only)
          `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>DIGEST_PLACEHOLDER</DigestValue></Reference></SignedInfo><SignatureValue>SIGNATURE_PLACEHOLDER</SignatureValue><KeyInfo><X509Data><X509Certificate>CERTIFICATE_PLACEHOLDER</X509Certificate></X509Data></KeyInfo></Signature>` +
          // protNFe
          `<protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>CAIXAFACIL_SIMULADO</verAplic><chNFe>${escapeXmlText(chNFe)}</chNFe><dhRecbto>${escapeXmlText(protDh)}</dhRecbto><nProt>${escapeXmlText(nProt)}</nProt><digVal>DIGEST_PLACEHOLDER</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>` +
          `</NFe>` +
          `</nfeProc>`
        );
      };

      if (individual) {
        const zip = new Yazl.ZipFile();
        purchaseNotes.forEach((n, idx) => {
          const fname = `nfe-${(n.documentNumber && n.documentNumber.trim()) || (n as any)._id || idx}.xml`;
          const single = `<?xml version="1.0" encoding="UTF-8"?>${buildNfeProc(n, idx)}`;
          zip.addBuffer(Buffer.from(single, "utf8"), fname);
        });
        zip.end();

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          zip.outputStream.on("data", (d: Buffer) => chunks.push(Buffer.from(d)));
          zip.outputStream.on("end", () => resolve());
          zip.outputStream.on("error", (err) => reject(err));
        });
        const zipBuffer = Buffer.concat(chunks);
        return new NextResponse(new Uint8Array(zipBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="caixa-facil-${year}-${m}-notas-nfe.zip"`,
          },
        });
      }

      const entries = purchaseNotes.map(buildNfeProc).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${entries}`;
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=UTF-8",
          "Content-Disposition": `attachment; filename="caixa-facil-${year}-${m}-notas-nfe.xml"`,
        },
      });
    }

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

