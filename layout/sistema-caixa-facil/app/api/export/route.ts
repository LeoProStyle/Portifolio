import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import * as XLSX from "xlsx";
import * as Yazl from "yazl";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CashClosureModel, type CashClosureDoc } from "@/models/CashClosure";
import { ExpenseModel, type ExpenseDoc } from "@/models/Expense";
import { PurchaseNoteModel, type PurchaseNoteDoc } from "@/models/PurchaseNote";

export const runtime = "nodejs";

const escapeXmlText = (v: any) => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
};

async function generatePDF(
  month: string,
  year: string,
  closures: CashClosureDoc[],
  expenses: ExpenseDoc[],
  summary: { totalsByPayment: Record<string, number>; totalEntrada: number; totalDespesas: number; lucroEstimado: number }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = height - 40;
  page.drawText(`Relatório - ${month}/${year}`, { x: 40, y, size: 14, font });
  y -= 24;
  page.drawText(`Total Entradas: R$ ${String(summary.totalEntrada.toFixed(2))}`, { x: 40, y, size: 10, font });
  y -= 16;
  page.drawText(`Total Despesas: R$ ${String(summary.totalDespesas.toFixed(2))}`, { x: 40, y, size: 10, font });
  y -= 16;
  page.drawText(`Lucro Estimado: R$ ${String(summary.lucroEstimado.toFixed(2))}`, { x: 40, y, size: 10, font });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function generateExcel(
  month: string,
  year: string,
  closures: CashClosureDoc[],
  expenses: ExpenseDoc[],
  purchaseNotes: PurchaseNoteDoc[],
  summary: { totalsByPayment: Record<string, number>; totalEntrada: number; totalDespesas: number; lucroEstimado: number }
): Buffer {
  const workbook = XLSX.utils.book_new();
  if (closures.length > 0) {
    const rows: string[][] = [["Data", "Dinheiro", "PIX", "CartaoCredito", "CartaoDebito", "Total"]];
    closures.forEach((c) => rows.push([
      String(c.date ?? ""),
      String(c.dinheiro ?? 0),
      String(c.pix ?? 0),
      String(c.cartao_credito ?? 0),
      String(c.cartao_debito ?? 0),
      String(c.total ?? 0),
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows as any);
    XLSX.utils.book_append_sheet(workbook, ws, "Fechamentos");
  }
  if (expenses.length > 0) {
    const rows: string[][] = [["Data", "Categoria", "Descricao", "Valor"]];
    expenses.forEach((e) => rows.push([
      String(e.date ?? ""),
      String(e.category ?? ""),
      String(e.description ?? ""),
      String(e.amount ?? 0),
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows as any);
    XLSX.utils.book_append_sheet(workbook, ws, "Despesas");
  }
  if (purchaseNotes.length > 0) {
    const rows: string[][] = [["Data", "Categoria", "Descricao", "Fornecedor", "Valor"]];
    purchaseNotes.forEach((n) => rows.push([
      String(n.date ?? ""),
      String(n.category ?? ""),
      String(n.description ?? ""),
      String(n.supplier ?? ""),
      String(n.amount ?? 0),
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows as any);
    XLSX.utils.book_append_sheet(workbook, ws, "Notas");
  }
  const buf = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return Buffer.from(buf);
}


        const buildNfeProc = (n: PurchaseNoteDoc, idx: number) => {
          const genNumeric = (len: number) => Array.from({ length: len }).map(() => String(Math.floor(Math.random() * 10))).join("");

          // emitter defaults (use valid-looking fictitious values)
          const EMIT_CNPJ = process.env.FISCAL_CNPJ ?? "11222333000181";
          const EMIT_xNome = process.env.FISCAL_NAME ?? "Empresa Emitente";
          const EMIT_UF = process.env.FISCAL_UF ?? "SP";
          const EMIT_mun = process.env.FISCAL_MUN ?? "3550308"; // São Paulo default IBGE
          const EMIT_xMun = process.env.FISCAL_MUN_NAME ?? "SAO PAULO";
          const EMIT_IE = process.env.FISCAL_IE ?? "123456789123";
          const EMIT_xLgr = process.env.FISCAL_LOGRADOURO ?? "Endereco Emitente";
          const EMIT_nro = process.env.FISCAL_NUM ?? "1000";
          const EMIT_xBairro = process.env.FISCAL_BAIRRO ?? "Centro";
          const EMIT_CEP = process.env.FISCAL_CEP ?? "01001000";
          const EMIT_cPais = process.env.FISCAL_CPais ?? "1058";
          const EMIT_xPais = process.env.FISCAL_Pais ?? "Brasil";
          const EMIT_fone = process.env.FISCAL_FONE ?? "1122223333";

          // destination defaults
          const DEST_CPF_CNPJ = (n.documentNumber ?? "").replace(/\D/g, "");
          const DEST_xNome = n.supplier ?? n.description ?? "Consumidor Teste";
          const DEST_xLgr = n.supplierAddress ?? "Rua Consumidor";
          const DEST_nro = n.supplierNumber ?? "0";
          const DEST_xBairro = n.supplierNeighborhood ?? "Centro";
          const DEST_cMun = n.supplierMun ?? EMIT_mun;
          const DEST_xMun = n.supplierCity ?? EMIT_xMun;
          const DEST_UF = n.supplierUF ?? EMIT_UF;
          const DEST_CEP = n.supplierCEP ?? EMIT_CEP;

          // optional emitter fields coming from the purchase note
          // Use supplier/supplierCNPJ for the <emit> block as requested (prefer supplierCNPJ)
          const NOTE_EMIT_CNPJ_RAW = (n as any).supplierCNPJ ?? (n as any).supplierCnpj ?? (n as any).supplier_cnpj ?? (n as any).emitCNPJ ?? (n as any).emitterCNPJ ?? (n as any).emitterCnpj ?? (n as any).emitter?.cnpj ?? (n as any).documentNumber ?? null;
          const NOTE_EMIT_NAME = (n as any).supplier ?? (n as any).emitName ?? (n as any).emitterName ?? (n as any).emitter?.xNome ?? null;
          const NOTE_EMIT_IE = (n as any).emitIE ?? (n as any).emitIe ?? (n as any).emitter?.ie ?? null;
          // normalize/clean values: treat empty strings as absent
          const NOTE_EMIT_CNPJ_CLEAN = NOTE_EMIT_CNPJ_RAW ? String(NOTE_EMIT_CNPJ_RAW).replace(/\D/g, "") : null;
          const RES_EMIT_CNPJ = NOTE_EMIT_CNPJ_CLEAN && NOTE_EMIT_CNPJ_CLEAN.length > 0 ? NOTE_EMIT_CNPJ_CLEAN.padStart(14, "0") : EMIT_CNPJ;
          const RES_EMIT_XNOME = (NOTE_EMIT_NAME && String(NOTE_EMIT_NAME).trim()) ? String(NOTE_EMIT_NAME).trim() : EMIT_xNome;
          const RES_EMIT_IE = (NOTE_EMIT_IE && String(NOTE_EMIT_IE).trim()) ? String(NOTE_EMIT_IE).trim() : EMIT_IE;

          // determine model (55 default) and special handling for cupom (65)
          const mod = (n.model === "65" || String(n.model) === "65") ? "65" : "55";
          const tpImp = mod === "65" ? "4" : "1";
          const indPres = mod === "65" ? "1" : "0";

          // date handling
          const dateObj = n.date ? new Date(n.date) : new Date();
          const year = String(dateObj.getFullYear());
          const month = String(dateObj.getMonth() + 1).padStart(2, "0");
          const aamm = year.slice(2) + month; // AAMM

          // fields used to compose the access key (43 digits before cDV)
          const cUF = "35"; // São Paulo
          const CNPJ = RES_EMIT_CNPJ.replace(/\D/g, "").padStart(14, "0");
          const serie = String(n.serie ?? 1).padStart(3, "0");
          const nNF = String(n.documentNumber ? n.documentNumber : (idx + 1)).padStart(9, "0");
          const tpEmis = String(n.tpEmis ?? "1");
          const cNF = String(n.cNF ?? genNumeric(8)).padStart(8, "0");

          const chaveBase = cUF + aamm + CNPJ + mod + serie + nNF + tpEmis + cNF; // 43 chars

          // compute cDV using modulus 11 (weights 2..9 repeated, right-to-left)
          const computeDV = (base: string) => {
            const pesos = [2,3,4,5,6,7,8,9];
            let soma = 0;
            for (let i = base.length - 1, p = 0; i >= 0; i--, p++) {
              const dig = Number(base[i]);
              const peso = pesos[p % pesos.length];
              soma += dig * peso;
            }
            const resto = soma % 11;
            let dv = 11 - resto;
            if (dv >= 10) dv = 0;
            return String(dv);
          };

          const cDV = computeDV(chaveBase);
          const chNFe = chaveBase + cDV; // 44 digits
          const id = `NFe${chNFe}`;

          // identifiers
          const cNF_field = cNF;
          const dh = `${escapeXmlText(year + "-" + month + "-" + String(dateObj.getDate()).padStart(2, "0"))}T00:00:00-03:00`;

          const nfe: string[] = [];
          nfe.push(`<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`);
          nfe.push(`<infNFe Id="${escapeXmlText(id)}" versao="4.00">`);

          // ide
          nfe.push(`<ide>`);
          nfe.push(`<cUF>${escapeXmlText(cUF)}</cUF>`);
          nfe.push(`<cNF>${escapeXmlText(cNF_field)}</cNF>`);
          nfe.push(`<natOp>VENDA</natOp>`);
          nfe.push(`<mod>${escapeXmlText(mod)}</mod>`);
          nfe.push(`<serie>${escapeXmlText(serie)}</serie>`);
          nfe.push(`<nNF>${escapeXmlText(nNF)}</nNF>`);
          nfe.push(`<dhEmi>${dh}</dhEmi>`);
          nfe.push(`<tpNF>1</tpNF>`);
          nfe.push(`<idDest>1</idDest>`);
          nfe.push(`<cMunFG>${escapeXmlText(EMIT_mun)}</cMunFG>`);
          nfe.push(`<tpImp>${escapeXmlText(tpImp)}</tpImp>`);
          nfe.push(`<tpEmis>${escapeXmlText(tpEmis)}</tpEmis>`);
          nfe.push(`<cDV>${escapeXmlText(cDV)}</cDV>`);
          nfe.push(`<tpAmb>2</tpAmb>`);
          nfe.push(`<finNFe>1</finNFe>`);
          nfe.push(`<indFinal>1</indFinal>`);
          nfe.push(`<indPres>${escapeXmlText(indPres)}</indPres>`);
          nfe.push(`<procEmi>0</procEmi>`);
          nfe.push(`<verProc>caixa-facil-1.0</verProc>`);
          nfe.push(`</ide>`);

          // emit
          nfe.push(`<emit>`);
          nfe.push(`<CNPJ>${escapeXmlText(CNPJ)}</CNPJ>`);
          nfe.push(`<xNome>${escapeXmlText(RES_EMIT_XNOME)}</xNome>`);
          nfe.push(`<enderEmit>`);
          nfe.push(`<xLgr>${escapeXmlText(EMIT_xLgr)}</xLgr>`);
          nfe.push(`<nro>${escapeXmlText(EMIT_nro)}</nro>`);
          nfe.push(`<xBairro>${escapeXmlText(EMIT_xBairro)}</xBairro>`);
          nfe.push(`<cMun>${escapeXmlText(EMIT_mun)}</cMun>`);
          nfe.push(`<xMun>${escapeXmlText(EMIT_xMun)}</xMun>`);
          nfe.push(`<UF>${escapeXmlText(EMIT_UF)}</UF>`);
          nfe.push(`<CEP>${escapeXmlText(EMIT_CEP)}</CEP>`);
          nfe.push(`<cPais>${escapeXmlText(EMIT_cPais)}</cPais>`);
          nfe.push(`<xPais>${escapeXmlText(EMIT_xPais)}</xPais>`);
          nfe.push(`<fone>${escapeXmlText(EMIT_fone)}</fone>`);
          nfe.push(`</enderEmit>`);
          nfe.push(`<IE>${escapeXmlText(RES_EMIT_IE)}</IE>`);
          nfe.push(`<CRT>3</CRT>`);
          nfe.push(`</emit>`);

            // dest (replaced with user-provided block)
            nfe.push(`<dest>
        <CNPJ>66857779000174</CNPJ>
        <xNome>QG Ocian</xNome>
        <enderDest>
          <xLgr>Rua Consumidor</xLgr>
          <nro>0</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderDest>
        <indIEDest>9</indIEDest>
      </dest>`);

          // det (single item)
          nfe.push(`<det nItem="1">`);
          nfe.push(`<prod>`);
          nfe.push(`<cProd>ITEM${idx + 1}</cProd>`);
          nfe.push(`<cEAN></cEAN>`);
          nfe.push(`<xProd>${escapeXmlText(n.description ?? n.category ?? "Item Teste")}</xProd>`);
          nfe.push(`<NCM>${escapeXmlText((n.ncm ?? "01012100").padStart(8, "0"))}</NCM>`);
          nfe.push(`<CEST>${escapeXmlText((n.cest ?? "1234567").padStart(7, "0"))}</CEST>`);
          nfe.push(`<CFOP>${escapeXmlText(n.cfop ?? "5102")}</CFOP>`);
          nfe.push(`<uCom>un</uCom>`);
          nfe.push(`<qCom>1.0000</qCom>`);
          const amountStr = (n.amount ?? 0).toFixed(2);
          nfe.push(`<vUnCom>${escapeXmlText(amountStr)}</vUnCom>`);
          nfe.push(`<vProd>${escapeXmlText(amountStr)}</vProd>`);
          nfe.push(`<uTrib>un</uTrib>`);
          nfe.push(`<qTrib>1.0000</qTrib>`);
          nfe.push(`<vUnTrib>${escapeXmlText(amountStr)}</vUnTrib>`);
          nfe.push(`<indTot>1</indTot>`);
          nfe.push(`</prod>`);

          // imposto
          nfe.push(`<imposto>`);
          nfe.push(`<vTotTrib>0.00</vTotTrib>`);
          nfe.push(`<ICMS>`);
          nfe.push(`<ICMS00><orig>0</orig><CST>00</CST><modBC>0</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00>`);
          nfe.push(`</ICMS>`);
          nfe.push(`<PIS><PISAliq><CST>01</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISAliq></PIS>`);
          nfe.push(`<COFINS><COFINSAliq><CST>01</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSAliq></COFINS>`);
          nfe.push(`</imposto>`);
          nfe.push(`</det>`);

          // total with required ICMSTot fields
          nfe.push(`<total>`);
          nfe.push(`<ICMSTot>`);
          nfe.push(`<vBC>0.00</vBC>`);
          nfe.push(`<vICMS>0.00</vICMS>`);
          nfe.push(`<vICMSDeson>0.00</vICMSDeson>`);
          nfe.push(`<vFCP>0.00</vFCP>`);
          nfe.push(`<vBCST>0.00</vBCST>`);
          nfe.push(`<vST>0.00</vST>`);
          nfe.push(`<vFCPST>0.00</vFCPST>`);
          nfe.push(`<vFCPSTRet>0.00</vFCPSTRet>`);
          nfe.push(`<vProd>${escapeXmlText(amountStr)}</vProd>`);
          nfe.push(`<vFrete>0.00</vFrete>`);
          nfe.push(`<vSeg>0.00</vSeg>`);
          nfe.push(`<vDesc>0.00</vDesc>`);
          nfe.push(`<vII>0.00</vII>`);
          nfe.push(`<vIPI>0.00</vIPI>`);
          nfe.push(`<vIPIDevol>0.00</vIPIDevol>`);
          nfe.push(`<vPIS>0.00</vPIS>`);
          nfe.push(`<vCOFINS>0.00</vCOFINS>`);
          nfe.push(`<vOutro>0.00</vOutro>`);
          nfe.push(`<vNF>${escapeXmlText(amountStr)}</vNF>`);
          nfe.push(`<vTotTrib>0.00</vTotTrib>`);
          nfe.push(`</ICMSTot>`);
          nfe.push(`</total>`);

          // transp
          nfe.push(`<transp><modFrete>0</modFrete></transp>`);

          // pag
          nfe.push(`<pag><detPag><tPag>01</tPag><vPag>${escapeXmlText(amountStr)}</vPag></detPag></pag>`);

          // infAdic
          nfe.push(`<infAdic><infCpl>${escapeXmlText(n.note ?? "")}</infCpl></infAdic>`);

          // infRespTec - use valid-looking emitter CNPJ
          nfe.push(`<infRespTec><CNPJ>${escapeXmlText(CNPJ)}</CNPJ><xContato>Suporte</xContato><email>suporte@example.com</email><fone>${escapeXmlText(EMIT_fone)}</fone></infRespTec>`);

          nfe.push(`</infNFe>`);
          nfe.push(`</NFe>`);

          return nfe.join("");
        };
  export async function POST(req: Request) {
    const body = (await req.json().catch(() => ({}))) as {
      month: string;
      year: string;
      kind: "PDF" | "Excel" | "XML";
      types?: string[];
      selected?: Record<string, string[]>;
      individual?: boolean;
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
        // determine best CNPJ value for the note
        const rawSupplierCnpj = (n as any).supplierCNPJ ?? (n as any).supplierCnpj ?? (n as any).supplier_cnpj ?? null;
        const rawEmitCnpj = (n as any).emitCNPJ ?? (n as any).emitCnpj ?? (n as any).emitterCNPJ ?? (n as any).emitter?.cnpj ?? null;
        const rawFromDocument = (n as any).documentNumber ?? null;
        const pickRaw = rawSupplierCnpj || rawEmitCnpj || rawFromDocument || null;
        const cleaned = pickRaw ? String(pickRaw).replace(/\D/g, "") : "";
        const noteCnpj = cleaned && cleaned.length > 0 ? cleaned : "";

        return (
          `  <Nota data="${escapeXmlText(n.date)}">\n` +
          `    <Categoria>${escapeXmlText(n.category)}</Categoria>\n` +
          `    <Descricao>${escapeXmlText(n.description ?? "")}</Descricao>\n` +
          `    <Valor>${escapeXmlText(n.amount ?? 0)}</Valor>\n` +
          `    <CNPJ>${escapeXmlText(noteCnpj)}</CNPJ>\n` +
          `    <Fornecedor>${escapeXmlText(n.supplier ?? "")}</Fornecedor>\n` +
          `    <IE>${escapeXmlText((n as any).emitIE ?? (n as any).emitIe ?? "")}</IE>\n` +
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
          zip.outputStream.on("error", (err: unknown) => reject(err));
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

