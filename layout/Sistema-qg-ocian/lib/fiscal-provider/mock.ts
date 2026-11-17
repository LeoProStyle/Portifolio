/**
 * Provedor simulado — SÓ para testes e ambiente local (FISCAL_PROVIDER=mock).
 * Regras fixas: NCM "00000000" → rejeitada; total 999,99 → responde erro mas a nota fica autorizada
 * (simula resposta perdida); o resto → autorizada.
 */
import { mod11 } from "@/lib/fiscal";
import { emptyResult, type FiscalProvider, type FiscalResult } from "./types";

export const MOCK_LOST_RESPONSE_TOTAL = 99_999;

export function createMockProvider(): FiscalProvider {
  const notes = new Map<string, FiscalResult>();
  let seq = 0;

  const authorize = (): FiscalResult => {
    seq += 1;
    const base = "35" + "0".repeat(32) + String(seq).padStart(9, "0");
    return {
      ...emptyResult("autorizada", "Autorizado o uso da NF-e (simulado)"),
      accessKey: base + mod11(base),
      number: String(seq),
      series: "1",
      protocol: String(135_000_000_000_000 + seq),
      danfeUrl: "about:blank",
    };
  };

  return {
    name: "mock",
    environment: "homologacao",
    async emit(ref, sale) {
      if (notes.has(ref)) return notes.get(ref)!;
      if (sale.items.some((it) => it.fiscal?.ncm === "00000000")) return emptyResult("rejeitada", "778 - Informado NCM inexistente (simulado)");
      const note = authorize();
      notes.set(ref, note);
      if (sale.totalCents === MOCK_LOST_RESPONSE_TOTAL) return emptyResult("erro", "Provedor fiscal não respondeu. Tente de novo.");
      return note;
    },
    async consult(ref) {
      return notes.get(ref) ?? null;
    },
    async cancel(ref) {
      if (!notes.has(ref)) return { ok: false, message: "NFC-e não encontrada (simulado)" };
      notes.delete(ref);
      return { ok: true, message: "" };
    },
  };
}
