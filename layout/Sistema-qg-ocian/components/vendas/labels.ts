import type { SaleMethod } from "@/lib/sales-rules";
import type { FiscalStatus, SaleDTO } from "@/lib/types";

/** Nomes curtos das formas de pagamento no caixa. */
export const METHOD_LABELS: Record<SaleMethod, string> = {
  "01": "Dinheiro",
  "17": "PIX",
  "04": "Débito",
  "03": "Crédito",
  "11": "Vale refeição",
  "10": "Vale alimentação",
};

export const methodLabel = (m: string) => METHOD_LABELS[m as SaleMethod] ?? m;

export const FISCAL_LABELS: Record<FiscalStatus, string> = {
  pendente: "NFC-e em processamento",
  autorizada: "NFC-e autorizada",
  rejeitada: "NFC-e rejeitada",
  erro: "NFC-e sem resposta",
  cancelada: "NFC-e cancelada",
};

/** Link do comprovante: DANFE do provedor se a NFC-e foi autorizada; senão o comprovante 80 mm. */
export function receiptHref(sale: SaleDTO): string {
  if (sale.fiscal?.status === "autorizada" && sale.fiscal.danfeUrl && sale.fiscal.danfeUrl !== "about:blank") return sale.fiscal.danfeUrl;
  return `/vendas/comprovante/${sale.id}?print=1`;
}

export const saleNumber = (n: number) => String(n).padStart(6, "0");
