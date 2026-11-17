/**
 * Regras puras do caixa (Vendas): preço, pagamento/troco, cancelamento e prontidão fiscal.
 * Sem banco e sem Next — testável direto no vitest e usável no navegador.
 */
import type { Role } from "./auth";
import type {
  FiscalEnv,
  FiscalReadiness,
  FiscalSettingsDTO,
  InvoicePaymentDTO,
  ProductFiscalDTO,
  SaleDTO,
  SaleItemDTO,
  SalesDayResponse,
} from "./types";

/** Erro de regra de negócio; o serviço converte em ApiError com o mesmo status. */
export class SaleError extends Error {
  constructor(
    public status: 400 | 403 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Formas aceitas no caixa (códigos tPag da NF-e), na ordem em que aparecem na tela. */
export const SALE_METHODS = ["01", "17", "04", "03", "11", "10"] as const;
export type SaleMethod = (typeof SALE_METHODS)[number];
export const CASH: SaleMethod = "01";

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  emoji: string;
  priceCents: number;
  active: boolean;
}

export interface FiscalContext {
  byProduct: Map<string, ProductFiscalDTO>;
  defaults: FiscalSettingsDTO["defaults"];
}

/** Monta os itens da venda com preço/nome do cadastro (nunca do navegador). */
export function priceItems(
  lines: { productId: string; qty: number }[],
  products: Map<string, CatalogProduct>,
  fiscal?: FiscalContext,
): SaleItemDTO[] {
  const qtyById = new Map<string, number>();
  for (const l of lines) qtyById.set(l.productId, (qtyById.get(l.productId) ?? 0) + l.qty);

  return [...qtyById].map(([productId, qty]) => {
    const p = products.get(productId);
    if (!p) throw new SaleError(400, "Produto não encontrado");
    if (!p.active) throw new SaleError(400, `"${p.name}" está desativado`);
    const item: SaleItemDTO = {
      productId,
      name: p.name,
      category: p.category,
      emoji: p.emoji,
      unitCents: p.priceCents,
      qty,
      totalCents: p.priceCents * qty,
    };
    if (fiscal) {
      const f = fiscal.byProduct.get(productId);
      const d = fiscal.defaults;
      item.fiscal = {
        ncm: f?.ncm || "",
        cfop: f?.cfop || d.cfop,
        cest: f?.cest || "",
        unit: f?.unit || d.unit,
        origin: f?.origin || d.origin,
        taxCode: f?.taxCode || d.taxCode,
      };
    }
    return item;
  });
}

/** Confere pagamentos x total e calcula o troco (só sobre a parte em dinheiro). */
export function settlePayments(
  totalCents: number,
  payments: { method: SaleMethod; amountCents: number }[],
  receivedCents?: number,
): { payments: InvoicePaymentDTO[]; receivedCents: number; changeCents: number } {
  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents);
  const grouped = [...byMethod].map(([method, amountCents]) => ({ method, amountCents }));

  const paid = grouped.reduce((acc, p) => acc + p.amountCents, 0);
  if (paid !== totalCents) throw new SaleError(400, "A soma dos pagamentos precisa ser igual ao total");

  const cash = byMethod.get(CASH) ?? 0;
  if (cash === 0) return { payments: grouped, receivedCents: 0, changeCents: 0 };

  const received = receivedCents ?? cash;
  if (received < cash) throw new SaleError(400, "Valor recebido em dinheiro menor que o valor em dinheiro");
  return { payments: grouped, receivedCents: received, changeCents: received - cash };
}

/** Mensagem de bloqueio do cancelamento, ou null se pode cancelar. */
export function canCancel(role: Role, sale: Pick<SaleDTO, "date" | "status">, today: string): string | null {
  if (sale.status === "cancelada") return "Venda já cancelada";
  if (role !== "admin" && sale.date !== today) return "Só o dono cancela vendas de dias anteriores";
  return null;
}

/** O cupom fiscal está liberado? Lista o que falta e os produtos sem NCM. */
export function computeReadiness(input: {
  provider: string | null;
  environment: FiscalEnv | null;
  settings: FiscalSettingsDTO | null;
  products: CatalogProduct[];
  fiscal: ProductFiscalDTO[];
}): FiscalReadiness {
  const reasons: string[] = [];
  if (!input.provider) reasons.push("Provedor fiscal não configurado");
  if (!input.settings?.company.doc) reasons.push("Informe o CNPJ da empresa na Configuração fiscal");
  if (!input.settings?.company.ie) reasons.push("Informe a IE da empresa");

  const withNcm = new Set(input.fiscal.filter((f) => f.ncm).map((f) => f.productId));
  return {
    enabled: reasons.length === 0,
    provider: input.provider,
    environment: input.environment,
    reasons,
    missingNcm: input.products.filter((p) => p.active && !withNcm.has(p.id)).map((p) => p.id),
  };
}

/** Totais do dia (sem as canceladas), por forma de pagamento na ordem do caixa. */
export function dayTotals(sales: SaleDTO[]): SalesDayResponse["totals"] {
  const valid = sales.filter((s) => s.status !== "cancelada");
  const byMethod = new Map<string, number>();
  for (const s of valid) for (const p of s.payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents);
  return {
    count: valid.length,
    totalCents: valid.reduce((acc, s) => acc + s.totalCents, 0),
    byMethod: SALE_METHODS.filter((m) => (byMethod.get(m) ?? 0) > 0).map((m) => ({ method: m, amountCents: byMethod.get(m)! })),
  };
}
