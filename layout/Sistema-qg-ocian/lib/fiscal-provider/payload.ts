/** Venda → corpo da NFC-e na API da Focus NFe (v2). Função pura. */
import { cleanDoc, decimal2, decimal4 } from "@/lib/fiscal";
import { TIMEZONE } from "@/lib/date";
import type { FiscalSettingsDTO, SaleDTO } from "@/lib/types";

/** "2026-11-17T14:32:00-03:00" no horário de São Paulo (sem horário de verão desde 2019). */
export function spDateTime(d: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

/** Regime normal (CRT 3) usa CST de 2 dígitos; Simples/MEI usa CSOSN de 3. */
export function icmsCode(crt: string, itemCode: string, defaultCode: string): string {
  const len = crt === "3" ? 2 : 3;
  if (itemCode.length === len) return itemCode;
  if (defaultCode.length === len) return defaultCode;
  return crt === "3" ? "00" : "102";
}

export function buildFocusNfcePayload(sale: SaleDTO, settings: FiscalSettingsDTO, issuedAt: Date): Record<string, unknown> {
  const { company, defaults } = settings;
  const doc = cleanDoc(sale.customerDoc);
  return {
    cnpj_emitente: cleanDoc(company.doc),
    data_emissao: spDateTime(issuedAt),
    natureza_operacao: "VENDA AO CONSUMIDOR",
    presenca_comprador: "1",
    modalidade_frete: "9",
    local_destino: "1",
    ...(doc.length === 11 ? { cpf_destinatario: doc } : doc.length === 14 ? { cnpj_destinatario: doc } : {}),
    items: sale.items.map((it, i) => {
      const f = it.fiscal;
      const unit = f?.unit || defaults.unit;
      const vUn = decimal2(it.unitCents);
      const q = decimal4(it.qty);
      return {
        numero_item: String(i + 1),
        codigo_produto: it.productId,
        descricao: it.name,
        codigo_ncm: f?.ncm ?? "",
        cfop: f?.cfop || defaults.cfop,
        unidade_comercial: unit,
        unidade_tributavel: unit,
        quantidade_comercial: q,
        quantidade_tributavel: q,
        valor_unitario_comercial: vUn,
        valor_unitario_tributavel: vUn,
        valor_bruto: decimal2(it.totalCents),
        icms_origem: f?.origin || defaults.origin,
        icms_situacao_tributaria: icmsCode(company.crt, f?.taxCode ?? "", defaults.taxCode),
      };
    }),
    // a parte em dinheiro vai pelo valor aplicado na venda (o troco não entra no total)
    formas_pagamento: sale.payments.map((p) => ({ forma_pagamento: p.method, valor_pagamento: decimal2(p.amountCents) })),
  };
}
