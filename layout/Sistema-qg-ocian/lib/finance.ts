/** Regras e rótulos do financeiro (puras — usadas pelas telas, APIs e testes). */
import { dateRange, monthRange, todayKey } from "./date";
import type { ClosingDTO, ClosingRow, ExpensePayment, ExpenseType } from "./types";

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  despesa: "Despesa",
  cartao: "Cartão de crédito",
  suprimento: "Suprimentos",
};

export const EXPENSE_PAYMENT_LABELS: Record<ExpensePayment, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};

/** Formas de pagamento da maquininha, na ordem em que aparecem na tela e na planilha. */
export const CLOSING_METHODS = [
  { key: "debitCents", label: "Débito" },
  { key: "creditCents", label: "Crédito" },
  { key: "pixCents", label: "PIX" },
  { key: "voucherCents", label: "Voucher" },
] as const;

export function closingTotal(c: Pick<ClosingDTO, "debitCents" | "creditCents" | "pixCents" | "voucherCents">): number {
  return c.debitCents + c.creditCents + c.pixCents + c.voucherCents;
}

/**
 * Monta as linhas do mês (do dia 1 até o fim do mês, sem passar de hoje), mais recentes primeiro.
 * `saida` = total anotado na aba Saída por dia, para conferir com a maquininha.
 */
export function buildClosingRows(
  month: string,
  closings: ClosingDTO[],
  saida: Map<string, number>,
  today: string = todayKey(),
): ClosingRow[] {
  const { from, to } = monthRange(month);
  if (from > today) return [];
  const byDate = new Map(closings.map((c) => [c.date, c]));
  return dateRange(from, to < today ? to : today)
    .reverse()
    .map((date) => ({ date, closing: byDate.get(date) ?? null, saidaCents: saida.get(date) ?? null }));
}

export function sumBy<T>(list: T[], pick: (item: T) => number): number {
  return list.reduce((acc, item) => acc + pick(item), 0);
}
