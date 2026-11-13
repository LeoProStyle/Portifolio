/**
 * Cupons fiscais e não fiscais → XML no layout da NF-e 4.00 (mesma estrutura de docs/ref/*.xml).
 * Funções puras: podem rodar no servidor e no navegador (o formulário usa parseAccessKey/isValidDoc).
 */
import type { InvoiceDTO, InvoiceItemDTO, PartyDTO } from "./types";

/** Código IBGE de cada UF (2 primeiros dígitos da chave de acesso). */
export const UF_CODES = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
} as const;
export type UF = keyof typeof UF_CODES;
export const UFS = Object.keys(UF_CODES) as UF[];

/** Formas de pagamento (tPag da NF-e). */
export const PAYMENT_METHODS = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de crédito",
  "04": "Cartão de débito",
  "05": "Crédito loja",
  "10": "Vale alimentação",
  "11": "Vale refeição",
  "15": "Boleto",
  "16": "Depósito bancário",
  "17": "PIX",
  "18": "Transferência / carteira digital",
  "90": "Sem pagamento",
  "99": "Outros",
} as const;
export type PaymentCode = keyof typeof PAYMENT_METHODS;

export const CRT_LABELS = { "1": "Simples Nacional", "2": "Simples (excesso de sublimite)", "3": "Regime normal", "4": "MEI" } as const;
export const IE_IND_LABELS = { "1": "Contribuinte ICMS", "2": "Contribuinte isento", "9": "Não contribuinte" } as const;

/**
 * Campos fixos copiados do XML de referência. Mude aqui se o contador pedir outro valor
 * (ex.: tpAmb 1 = produção, 2 = homologação).
 */
export const XML_FIXED = {
  tpNF: "1",
  idDest: "1",
  tpImp: "1",
  tpEmis: "1",
  tpAmb: "2",
  finNFe: "1",
  indFinal: "1",
  indPres: "0",
  procEmi: "0",
  verProc: "qg-ocian-1.0",
  cPais: "1058",
  xPais: "Brasil",
  modFrete: "0",
  respTecContato: "Suporte",
  respTecEmail: "suporte@example.com",
} as const;

/* ---------------- Documentos (CNPJ / CPF / chave) ---------------- */

/** Só dígitos e letras maiúsculas (CNPJ alfanumérico vale desde jul/2026). */
export function cleanDoc(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valor de cada caractere no cálculo do DV: código ASCII − 48 (0–9 → 0–9, A → 17…). */
const charValue = (c: string) => c.charCodeAt(0) - 48;

/** DV módulo 11 com pesos 2..9 da direita para a esquerda (chave de acesso). */
export function mod11(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += charValue(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

function cnpjDigit(base: string): number {
  const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = [...base].reduce((acc, c, i) => acc + charValue(c) * weights[i], 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidCNPJ(value: string): boolean {
  const v = cleanDoc(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v) || /^(\d)\1{13}$/.test(v)) return false;
  const d1 = cnpjDigit(v.slice(0, 12));
  const d2 = cnpjDigit(v.slice(0, 12) + d1);
  return v.endsWith(`${d1}${d2}`);
}

export function isValidCPF(value: string): boolean {
  const v = onlyDigits(value);
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  const digit = (len: number) => {
    const sum = [...v.slice(0, len)].reduce((acc, c, i) => acc + Number(c) * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(v[9]) && digit(10) === Number(v[10]);
}

export function isValidDoc(value: string): boolean {
  const v = cleanDoc(value);
  return v.length === 11 ? isValidCPF(v) : isValidCNPJ(v);
}

export function formatDoc(value: string): string {
  const v = cleanDoc(value);
  if (v.length === 14) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  if (v.length === 11) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  return value;
}

const KEY_RE = /^\d{6}[0-9A-Z]{12}\d{26}$/;

export function isValidAccessKey(value: string): boolean {
  const v = cleanDoc(value);
  return KEY_RE.test(v) && mod11(v.slice(0, 43)) === Number(v[43]);
}

/** Lê os campos de uma chave de acesso de 44 posições (para preencher o formulário). */
export function parseAccessKey(value: string) {
  const v = cleanDoc(value);
  if (!isValidAccessKey(v)) return null;
  const uf = (Object.entries(UF_CODES).find(([, code]) => code === v.slice(0, 2))?.[0] ?? null) as UF | null;
  return {
    uf,
    yearMonth: `20${v.slice(2, 4)}-${v.slice(4, 6)}`,
    emitterDoc: v.slice(6, 20),
    model: v.slice(20, 22),
    series: Number(v.slice(22, 25)),
    number: Number(v.slice(25, 34)),
    tpEmis: v.slice(34, 35),
    cNF: v.slice(35, 43),
    dv: v.slice(43),
  };
}

/** Monta a chave de acesso a partir dos dados do documento (quando não foi informada). */
export function buildAccessKey(inv: Pick<InvoiceDTO, "emitter" | "issueDate" | "model" | "series" | "number" | "cNF">): string {
  const cUF = UF_CODES[inv.emitter.uf as UF] ?? "35";
  const aamm = inv.issueDate.slice(2, 4) + inv.issueDate.slice(5, 7);
  const doc = cleanDoc(inv.emitter.doc).padStart(14, "0").slice(-14);
  const base =
    cUF +
    aamm +
    doc +
    inv.model +
    String(inv.series).padStart(3, "0") +
    String(inv.number).padStart(9, "0") +
    XML_FIXED.tpEmis +
    inv.cNF.padStart(8, "0");
  return base + mod11(base);
}

export function randomCNF(): string {
  return String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
}

/* ---------------- Valores ---------------- */

/** Centavos → "387.93" (sem passar por ponto flutuante). */
export function decimal2(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function decimal4(qty: number): string {
  return qty.toFixed(4);
}

/** Valor do item = quantidade × valor unitário, arredondado ao centavo. */
export function itemTotalCents(item: Pick<InvoiceItemDTO, "qty" | "unitCents">): number {
  return Math.round(item.qty * item.unitCents);
}

/* ---------------- XML ---------------- */

export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** <tag>valor</tag> com escape; aceita vazio (<tag></tag>), como no XML de referência. */
const t = (tag: string, value: string | number = "") => `<${tag}>${escapeXml(value)}</${tag}>`;

function docTag(doc: string) {
  const v = cleanDoc(doc);
  return v.length === 11 ? t("CPF", v) : t("CNPJ", v);
}

function address(p: PartyDTO) {
  return (
    t("xLgr", p.street) +
    t("nro", p.number) +
    t("xBairro", p.district) +
    t("cMun", p.cityCode) +
    t("xMun", p.city.toUpperCase()) +
    t("UF", p.uf) +
    t("CEP", onlyDigits(p.cep)) +
    t("cPais", XML_FIXED.cPais) +
    t("xPais", XML_FIXED.xPais) +
    (p.phone ? t("fone", onlyDigits(p.phone)) : "")
  );
}

/** Chave usada no XML: a informada (se válida) ou a calculada. */
export function invoiceKey(inv: InvoiceDTO): string {
  return inv.accessKey && isValidAccessKey(inv.accessKey) ? cleanDoc(inv.accessKey) : buildAccessKey(inv);
}

/** Gera o XML (NF-e 4.00) do cupom, com a mesma estrutura do arquivo de referência. */
export function buildInvoiceXml(inv: InvoiceDTO): string {
  const key = invoiceKey(inv);
  const cNF = key.slice(35, 43);
  const cDV = key.slice(43);
  const e = inv.emitter;
  const d = inv.recipient;
  const total = decimal2(inv.totalCents);
  const zero = "0.00";

  const ide =
    "<ide>" +
    t("cUF", UF_CODES[e.uf as UF] ?? key.slice(0, 2)) +
    t("cNF", cNF) +
    t("natOp", inv.natOp) +
    t("mod", inv.model) +
    t("serie", String(inv.series).padStart(3, "0")) +
    t("nNF", String(inv.number).padStart(9, "0")) +
    t("dhEmi", `${inv.issueDate}T${inv.issueTime}:00-03:00`) +
    t("tpNF", XML_FIXED.tpNF) +
    t("idDest", XML_FIXED.idDest) +
    t("cMunFG", e.cityCode) +
    t("tpImp", XML_FIXED.tpImp) +
    t("tpEmis", XML_FIXED.tpEmis) +
    t("cDV", cDV) +
    t("tpAmb", XML_FIXED.tpAmb) +
    t("finNFe", XML_FIXED.finNFe) +
    t("indFinal", XML_FIXED.indFinal) +
    t("indPres", XML_FIXED.indPres) +
    t("procEmi", XML_FIXED.procEmi) +
    t("verProc", XML_FIXED.verProc) +
    "</ide>";

  const emit =
    "<emit>" +
    docTag(e.doc) +
    t("xNome", e.name) +
    "<enderEmit>" +
    address(e) +
    "</enderEmit>" +
    t("IE", e.ie) +
    t("CRT", e.crt) +
    "</emit>";

  const dest =
    "<dest>" +
    docTag(d.doc) +
    t("xNome", d.name) +
    "<enderDest>" +
    address(d) +
    "</enderDest>" +
    t("indIEDest", d.ieIndicator) +
    (d.ieIndicator === "1" && d.ie ? t("IE", d.ie) : "") +
    "</dest>";

  const zeros = (...tags: string[]) => tags.map((tag) => t(tag, zero)).join("");

  const dets = inv.items
    .map((it, i) => {
      const vUn = decimal2(it.unitCents);
      const q = decimal4(it.qty);
      return (
        `<det nItem="${i + 1}">` +
        "<prod>" +
        t("cProd", it.code || `ITEM${i + 1}`) +
        t("cEAN", it.ean) +
        t("xProd", it.description) +
        t("NCM", it.ncm) +
        t("CEST", it.cest) +
        t("CFOP", it.cfop) +
        t("uCom", it.unit) +
        t("qCom", q) +
        t("vUnCom", vUn) +
        t("vProd", decimal2(it.totalCents)) +
        t("uTrib", it.unit) +
        t("qTrib", q) +
        t("vUnTrib", vUn) +
        t("indTot", "1") +
        "</prod>" +
        "<imposto>" +
        t("vTotTrib", zero) +
        "<ICMS><ICMS00>" +
        t("orig", "0") +
        t("CST", "00") +
        t("modBC", "0") +
        zeros("vBC", "pICMS", "vICMS") +
        "</ICMS00></ICMS>" +
        "<PIS><PISAliq>" +
        t("CST", "01") +
        zeros("vBC", "pPIS", "vPIS") +
        "</PISAliq></PIS>" +
        "<COFINS><COFINSAliq>" +
        t("CST", "01") +
        zeros("vBC", "pCOFINS", "vCOFINS") +
        "</COFINSAliq></COFINS>" +
        "</imposto>" +
        "</det>"
      );
    })
    .join("");

  const totalTag =
    "<total><ICMSTot>" +
    zeros("vBC", "vICMS", "vICMSDeson", "vFCP", "vBCST", "vST", "vFCPST", "vFCPSTRet") +
    t("vProd", total) +
    zeros("vFrete", "vSeg", "vDesc", "vII", "vIPI", "vIPIDevol", "vPIS", "vCOFINS", "vOutro") +
    t("vNF", total) +
    t("vTotTrib", zero) +
    "</ICMSTot></total>";

  const pag =
    "<pag>" +
    inv.payments.map((p) => "<detPag>" + t("tPag", p.method) + t("vPag", decimal2(p.amountCents)) + "</detPag>").join("") +
    "</pag>";

  const infCpl = [inv.kind === "nao_fiscal" ? "DOCUMENTO NAO FISCAL" : "", inv.notes].filter(Boolean).join(" - ");
  const respCnpj = cleanDoc(e.doc).length === 14 ? cleanDoc(e.doc) : cleanDoc(d.doc);
  const respTec =
    "<infRespTec>" +
    t("CNPJ", respCnpj) +
    t("xContato", XML_FIXED.respTecContato) +
    t("email", XML_FIXED.respTecEmail) +
    (e.phone ? t("fone", onlyDigits(e.phone)) : "") +
    "</infRespTec>";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
    `<infNFe Id="NFe${key}" versao="4.00">` +
    ide +
    emit +
    dest +
    dets +
    totalTag +
    "<transp>" +
    t("modFrete", XML_FIXED.modFrete) +
    "</transp>" +
    pag +
    "<infAdic>" +
    t("infCpl", infCpl) +
    "</infAdic>" +
    respTec +
    "</infNFe></NFe>"
  );
}

export function invoiceFileName(inv: InvoiceDTO): string {
  return `nfe-${invoiceKey(inv)}.xml`;
}
