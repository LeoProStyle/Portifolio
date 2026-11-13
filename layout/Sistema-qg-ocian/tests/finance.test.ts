import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAccessKey,
  buildInvoiceXml,
  decimal2,
  isValidAccessKey,
  isValidCNPJ,
  isValidCPF,
  mod11,
  parseAccessKey,
} from "@/lib/fiscal";
import { addMonths, formatDateBR, isMonthKey, monthRange } from "@/lib/date";
import { buildClosingRows, closingTotal } from "@/lib/finance";
import { isAdminPath } from "@/lib/auth";
import { ExpenseInput, InvoiceInput } from "@/lib/validation";
import { buildSheet, colLetter } from "@/lib/xlsx";
import type { InvoiceDTO, PartyDTO } from "@/lib/types";

const REF_DIR = join(__dirname, "..", "docs", "ref");
const refXml = readFileSync(join(REF_DIR, readdirSync(REF_DIR).find((f) => f.endsWith(".xml"))!), "utf8");

/** Sequência de elementos (abertura) do XML, ignorando espaços entre tags. */
const tagSequence = (xml: string) => [...xml.matchAll(/<([A-Za-z][\w]*)[\s>/]/g)].map((m) => m[1]);
const tagValue = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

const party = (over: Partial<PartyDTO>): PartyDTO => ({
  doc: "",
  name: "",
  ie: "",
  crt: "3",
  ieIndicator: "9",
  street: "",
  number: "",
  district: "Centro",
  cityCode: "3550308",
  city: "SAO PAULO",
  uf: "SP",
  cep: "01001000",
  phone: "",
  ...over,
});

/** Mesmo conteúdo do XML de referência (docs/ref). */
const refInvoice: InvoiceDTO = {
  id: "x",
  kind: "fiscal",
  model: "55",
  series: 1,
  number: 1,
  issueDate: "2026-10-01",
  issueTime: "00:00",
  natOp: "VENDA",
  accessKey: "",
  cNF: "00000000",
  emitter: party({ doc: "63927071000154", name: "embalagens", street: "Endereco Emitente", number: "1000", phone: "1122223333" }),
  recipient: party({ doc: "66857779000174", name: "QG Ocian", street: "Rua Consumidor", number: "0" }),
  items: [
    { code: "ITEM1", ean: "", description: "mercadoria", ncm: "00000000", cest: "0000000", cfop: "", unit: "un", qty: 1, unitCents: 38793, totalCents: 38793 },
  ],
  payments: [{ method: "01", amountCents: 38793 }],
  totalCents: 38793,
  notes: "",
};

describe("XML do cupom (layout NF-e do docs/ref)", () => {
  const xml = buildInvoiceXml(refInvoice);

  it("tem exatamente a mesma sequência de tags do XML de referência", () => {
    expect(tagSequence(xml)).toEqual(tagSequence(refXml));
  });

  it("repete os valores do XML de referência", () => {
    for (const tag of ["cUF", "natOp", "mod", "serie", "nNF", "dhEmi", "cMunFG", "tpAmb", "xNome", "CRT", "qCom", "vUnCom", "vProd", "vNF", "tPag", "vPag", "indIEDest", "CEST", "fone"]) {
      expect(tagValue(xml, tag), tag).toBe(tagValue(refXml, tag));
    }
  });

  it("chave = a da referência com DV calculado (módulo 11)", () => {
    const refKey = refXml.match(/Id="NFe(\d{44})"/)![1];
    const key = xml.match(/Id="NFe(\d{44})"/)![1];
    expect(key.slice(0, 43)).toBe(refKey.slice(0, 43));
    expect(isValidAccessKey(key)).toBe(true);
    expect(tagValue(xml, "cDV")).toBe(key.slice(43));
  });

  it("usa a chave informada quando é válida", () => {
    const key = buildAccessKey({ ...refInvoice, cNF: "12345678" });
    const out = buildInvoiceXml({ ...refInvoice, accessKey: key });
    expect(out).toContain(`Id="NFe${key}"`);
    expect(tagValue(out, "cNF")).toBe("12345678");
  });

  it("escapa caracteres especiais e marca documento não fiscal", () => {
    const out = buildInvoiceXml({
      ...refInvoice,
      kind: "nao_fiscal",
      notes: "Pão & café <promo>",
      emitter: { ...refInvoice.emitter, name: "D'Ávila & Cia" },
    });
    expect(out).toContain("<xNome>D&apos;Ávila &amp; Cia</xNome>");
    expect(tagValue(out, "infCpl")).toBe("DOCUMENTO NAO FISCAL - Pão &amp; café &lt;promo&gt;");
  });

  it("emitente com CPF usa a tag <CPF>", () => {
    const out = buildInvoiceXml({ ...refInvoice, emitter: { ...refInvoice.emitter, doc: "52998224725" } });
    expect(out).toContain("<emit><CPF>52998224725</CPF>");
  });
});

describe("documentos", () => {
  it("valida CNPJ numérico e alfanumérico", () => {
    expect(isValidCNPJ("63.927.071/0001-54")).toBe(true);
    expect(isValidCNPJ("66857779000174")).toBe(true);
    expect(isValidCNPJ("12ABC34501DE35")).toBe(true); // exemplo oficial da Receita (CNPJ alfanumérico)
    expect(isValidCNPJ("63927071000155")).toBe(false);
    expect(isValidCNPJ("11111111111111")).toBe(false);
  });
  it("valida CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224724")).toBe(false);
  });
  it("mod11 e leitura da chave", () => {
    expect(mod11("0")).toBe(0);
    const key = buildAccessKey({ ...refInvoice, number: 123, series: 2, cNF: "87654321" });
    expect(parseAccessKey(key)).toMatchObject({ uf: "SP", model: "55", series: 2, number: 123, cNF: "87654321", emitterDoc: "63927071000154" });
    expect(parseAccessKey(key.slice(0, 43) + ((Number(key[43]) + 1) % 10))).toBeNull();
  });
  it("decimal2 sem erro de ponto flutuante", () => {
    expect(decimal2(38793)).toBe("387.93");
    expect(decimal2(5)).toBe("0.05");
    expect(decimal2(0)).toBe("0.00");
  });
});

describe("validação do cupom", () => {
  const input = {
    kind: "fiscal",
    model: "55",
    series: 1,
    number: 10,
    issueDate: "2026-11-10",
    emitter: { ...refInvoice.emitter, doc: "63.927.071/0001-54" },
    recipient: refInvoice.recipient,
    items: [{ description: "Copo 300ml", qty: 2.5, unitCents: 1000 }],
    payments: [{ method: "17", amountCents: 2500 }],
  };
  it("aceita e normaliza", () => {
    const v = InvoiceInput.parse(input);
    expect(v.emitter.doc).toBe("63927071000154");
    expect(v.items[0]).toMatchObject({ ncm: "00000000", unit: "un" });
  });
  it("recusa pagamento diferente do total", () => {
    expect(() => InvoiceInput.parse({ ...input, payments: [{ method: "17", amountCents: 2400 }] })).toThrow(/soma dos pagamentos/);
  });
  it("recusa chave que não confere com o número", () => {
    const key = buildAccessKey({ ...refInvoice, number: 99 });
    expect(() => InvoiceInput.parse({ ...input, accessKey: key })).toThrow(/não confere/);
  });
  it("cupom não fiscal pode ir sem CNPJ", () => {
    expect(InvoiceInput.parse({ ...input, kind: "nao_fiscal", emitter: { ...input.emitter, doc: "" } }).kind).toBe("nao_fiscal");
  });
});

describe("despesas", () => {
  it("compra no cartão vira crédito; parcelas só no crédito", () => {
    const base = { date: "2026-11-10", description: "Copos", amountCents: 1000, installments: 3 };
    expect(ExpenseInput.parse({ ...base, type: "cartao", paymentMethod: "pix" })).toMatchObject({ paymentMethod: "credito", installments: 3 });
    expect(ExpenseInput.parse({ ...base, type: "suprimento", paymentMethod: "pix" }).installments).toBe(1);
  });
});

describe("fechamentos", () => {
  const c = { date: "2026-11-02", debitCents: 100, creditCents: 200, pixCents: 300, voucherCents: 400, feesCents: 10, totalCents: 1000, notes: "" };
  it("total da maquininha", () => expect(closingTotal(c)).toBe(1000));
  it("linhas do mês até hoje, mais recentes primeiro", () => {
    const rows = buildClosingRows("2026-11", [c], new Map([["2026-11-02", 900]]), "2026-11-03");
    expect(rows.map((r) => r.date)).toEqual(["2026-11-03", "2026-11-02", "2026-11-01"]);
    expect(rows[1]).toMatchObject({ closing: c, saidaCents: 900 });
    expect(rows[0].saidaCents).toBeNull();
    expect(buildClosingRows("2026-12", [], new Map(), "2026-11-03")).toEqual([]);
    expect(buildClosingRows("2026-10", [], new Map(), "2026-11-03")).toHaveLength(31);
  });
});

describe("meses", () => {
  it("helpers", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(formatDateBR("2026-11-13")).toBe("13/11/2026");
  });
  it("financeiro é só do dono", () => {
    expect(isAdminPath("/api/finance/closings")).toBe(true);
    expect(isAdminPath("/admin/cupons")).toBe(true);
  });
});

describe("planilha", () => {
  it("colLetter", () => {
    expect(colLetter(1)).toBe("A");
    expect(colLetter(27)).toBe("AA");
  });
  it("gera xlsx com linha de TOTAL (fórmula SOMA)", async () => {
    const buf = await buildSheet({
      sheetName: "Teste",
      title: "Teste",
      columns: [
        { header: "Data", key: "date", type: "date" },
        { header: "Valor", key: "v", type: "money", total: true },
      ],
      rows: [
        { date: "2026-11-01", v: 1050 },
        { date: "2026-11-02", v: 2000 },
      ],
    });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getCell("A6").value).toBe("TOTAL");
    expect(ws.getCell("B6").value).toMatchObject({ formula: "SUM(B4:B5)", result: 30.5 });
    expect(ws.getCell("B4").value).toBe(10.5);
  });
});
