/** Formatos que trafegam entre API e telas (JSON). */

export interface ProductDTO {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  emoji: string;
  active: boolean;
  sortOrder: number;
}

export interface RegisterItemDTO {
  productId: string;
  name: string;
  category: string;
  emoji: string;
  priceCents: number;
  qty: number;
}

export interface RegisterDTO {
  date: string;
  status: "open" | "closed";
  items: RegisterItemDTO[];
  totalCents: number;
  totalItems: number;
  notes: string;
  closedAt: string | null;
}

export interface SaidaResponse {
  today: string;
  register: RegisterDTO;
  products: ProductDTO[];
  /** Dias anteriores que ficaram abertos (esqueceram de fechar). */
  pendingDates: string[];
}

export interface StatsDay {
  date: string;
  status: "open" | "closed" | "empty";
  totalCents: number;
  totalItems: number;
  notes: string;
  items: RegisterItemDTO[];
}

export interface StatsProduct {
  productId: string;
  name: string;
  emoji: string;
  category: string;
  qty: number;
  totalCents: number;
}

export interface StatsResponse {
  from: string;
  to: string;
  totals: { totalCents: number; totalItems: number; activeDays: number; avgPerDayCents: number };
  previous: { totalCents: number; totalItems: number };
  days: StatsDay[];
  products: StatsProduct[];
  categories: { category: string; qty: number; totalCents: number }[];
}

/* ===================== Financeiro (Admin) ===================== */

/** Fechamento diário da maquininha. */
export interface ClosingDTO {
  date: string;
  debitCents: number;
  creditCents: number;
  pixCents: number;
  voucherCents: number;
  /** Taxas da maquininha descontadas (opcional). */
  feesCents: number;
  totalCents: number;
  notes: string;
}

/** Linha da tela de fechamentos: dia do mês + fechamento (se houver) + total anotado na Saída. */
export interface ClosingRow {
  date: string;
  closing: ClosingDTO | null;
  saidaCents: number | null;
}

export interface ClosingsResponse {
  month: string;
  today: string;
  rows: ClosingRow[];
}

export type ExpenseType = "despesa" | "cartao" | "suprimento";
export type ExpensePayment = "dinheiro" | "pix" | "debito" | "credito" | "boleto" | "transferencia" | "outro";

export interface ExpenseDTO {
  id: string;
  date: string;
  type: ExpenseType;
  category: string;
  description: string;
  supplier: string;
  amountCents: number;
  paymentMethod: ExpensePayment;
  installments: number;
  notes: string;
}

export interface ExpensesResponse {
  month: string;
  expenses: ExpenseDTO[];
  categories: string[];
  suppliers: string[];
}

export type InvoiceKind = "fiscal" | "nao_fiscal";

/** Emitente ou destinatário. `crt` só vale para o emitente; `ieIndicator` só para o destinatário. */
export interface PartyDTO {
  doc: string;
  name: string;
  ie: string;
  crt: "1" | "2" | "3" | "4";
  ieIndicator: "1" | "2" | "9";
  street: string;
  number: string;
  district: string;
  cityCode: string;
  city: string;
  uf: string;
  cep: string;
  phone: string;
}

export interface InvoiceItemDTO {
  code: string;
  ean: string;
  description: string;
  ncm: string;
  cest: string;
  cfop: string;
  unit: string;
  /** Quantidade (até 4 casas). */
  qty: number;
  unitCents: number;
  totalCents: number;
}

export interface InvoicePaymentDTO {
  method: string;
  amountCents: number;
}

export interface InvoiceDTO {
  id: string;
  kind: InvoiceKind;
  model: "55" | "65";
  series: number;
  number: number;
  issueDate: string;
  /** "HH:mm" */
  issueTime: string;
  natOp: string;
  accessKey: string;
  cNF: string;
  emitter: PartyDTO;
  recipient: PartyDTO;
  items: InvoiceItemDTO[];
  payments: InvoicePaymentDTO[];
  totalCents: number;
  notes: string;
}

export interface InvoicesResponse {
  month: string;
  invoices: InvoiceDTO[];
  /** Emitentes já usados (para preencher o formulário). */
  emitters: PartyDTO[];
  /** Último destinatário usado (dados da loja). */
  lastRecipient: PartyDTO | null;
}
