import { z } from "zod";
import { currentMonthKey, isDateKey, isMonthKey } from "./date";
import {
  PAYMENT_METHODS,
  UFS,
  cleanDoc,
  isValidAccessKey,
  isValidDoc,
  itemTotalCents,
  onlyDigits,
  parseAccessKey,
  type PaymentCode,
} from "./fiscal";

export const ProductInput = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60, "Nome muito longo"),
  category: z.string().trim().min(1, "Informe a categoria").max(40, "Categoria muito longa"),
  priceCents: z.number().int("Preço inválido").min(0, "Preço não pode ser negativo").max(10_000_00, "Preço muito alto"),
  emoji: z.string().trim().max(16).optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export const ProductPatch = ProductInput.partial();

export const DateKey = z.string().refine(isDateKey, "Data inválida");

export const QtyChange = z.object({
  productId: z.string().min(1),
  delta: z.union([z.literal(1), z.literal(-1)]),
  date: DateKey.optional(),
});

export const CloseDay = z.object({
  date: DateKey,
  notes: z.string().max(1000, "Observação muito longa").optional().default(""),
});

/* ===================== Financeiro ===================== */

export const MonthKey = z.string().refine(isMonthKey, "Mês inválido");

const Cents = (label: string) =>
  z.number().int(`${label}: valor inválido`).min(0, `${label}: não pode ser negativo`).max(100_000_000_00, `${label}: valor muito alto`);

export const ClosingInput = z.object({
  date: DateKey,
  debitCents: Cents("Débito"),
  creditCents: Cents("Crédito"),
  pixCents: Cents("PIX"),
  voucherCents: Cents("Voucher"),
  feesCents: Cents("Taxas").optional().default(0),
  notes: z.string().trim().max(500, "Observação muito longa").optional().default(""),
});

export const EXPENSE_TYPES = ["despesa", "cartao", "suprimento"] as const;
export const EXPENSE_PAYMENTS = ["dinheiro", "pix", "debito", "credito", "boleto", "transferencia", "outro"] as const;

export const ExpenseInput = z
  .object({
    date: DateKey,
    type: z.enum(EXPENSE_TYPES, "Tipo inválido"),
    category: z.string().trim().max(40, "Categoria muito longa").optional().default(""),
    description: z.string().trim().min(1, "Informe a descrição").max(120, "Descrição muito longa"),
    supplier: z.string().trim().max(80, "Fornecedor muito longo").optional().default(""),
    amountCents: Cents("Valor").refine((v) => v > 0, "Informe o valor"),
    paymentMethod: z.enum(EXPENSE_PAYMENTS, "Forma de pagamento inválida"),
    installments: z.number().int().min(1, "Parcelas inválidas").max(48, "Máximo de 48 parcelas").optional().default(1),
    notes: z.string().trim().max(500, "Observação muito longa").optional().default(""),
  })
  // compra no cartão de crédito é sempre paga no crédito
  .transform((e) => (e.type === "cartao" ? { ...e, paymentMethod: "credito" as const } : { ...e, installments: e.paymentMethod === "credito" ? e.installments : 1 }));

const digits = (label: string, len: number) =>
  z.string().trim().transform(onlyDigits).refine((v) => v === "" || v.length === len, `${label} deve ter ${len} dígitos`);

const Party = z.object({
  doc: z.string().trim().transform(cleanDoc).refine((v) => v === "" || isValidDoc(v), "CNPJ/CPF inválido"),
  name: z.string().trim().min(1, "Informe o nome / razão social").max(60, "Nome muito longo"),
  ie: z.string().trim().toUpperCase().max(14, "IE muito longa").optional().default(""),
  crt: z.enum(["1", "2", "3", "4"]).optional().default("3"),
  ieIndicator: z.enum(["1", "2", "9"]).optional().default("9"),
  street: z.string().trim().max(60).optional().default(""),
  number: z.string().trim().max(60).optional().default(""),
  district: z.string().trim().max(60).optional().default(""),
  cityCode: digits("Código do município (IBGE)", 7).optional().default(""),
  city: z.string().trim().max(60).optional().default(""),
  uf: z.enum(UFS, "UF inválida"),
  cep: digits("CEP", 8).optional().default(""),
  phone: z.string().trim().transform(onlyDigits).refine((v) => v === "" || (v.length >= 6 && v.length <= 14), "Telefone inválido").optional().default(""),
});

const InvoiceItem = z.object({
  code: z.string().trim().max(60).optional().default(""),
  ean: z.string().trim().max(14).refine((v) => v === "" || v === "SEM GTIN" || /^(\d{8}|\d{12,14})$/.test(v), "EAN/GTIN inválido").optional().default(""),
  description: z.string().trim().min(1, "Informe a descrição do item").max(120, "Descrição do item muito longa"),
  ncm: z.string().trim().refine((v) => /^\d{8}$/.test(v), "NCM deve ter 8 dígitos").optional().default("00000000"),
  cest: digits("CEST", 7).optional().default(""),
  cfop: digits("CFOP", 4).optional().default(""),
  unit: z.string().trim().min(1, "Informe a unidade").max(6, "Unidade muito longa").optional().default("un"),
  qty: z
    .number()
    .positive("Quantidade deve ser maior que zero")
    .max(99_999_999, "Quantidade muito alta")
    .refine((v) => Math.abs(v * 10_000 - Math.round(v * 10_000)) < 1e-6, "Quantidade com no máximo 4 casas decimais"),
  unitCents: Cents("Valor unitário"),
});

export const InvoiceInput = z
  .object({
    kind: z.enum(["fiscal", "nao_fiscal"], "Tipo inválido"),
    model: z.enum(["55", "65"], "Modelo inválido"),
    series: z.number().int().min(0).max(999, "Série vai até 999"),
    number: z.number().int().min(1, "Informe o número").max(999_999_999, "Número muito alto"),
    issueDate: DateKey,
    issueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida").optional().default("00:00"),
    natOp: z.string().trim().min(1, "Informe a natureza da operação").max(60).optional().default("VENDA"),
    accessKey: z.string().trim().transform(cleanDoc).refine((v) => v === "" || isValidAccessKey(v), "Chave de acesso inválida (44 dígitos)").optional().default(""),
    emitter: Party,
    recipient: Party,
    items: z.array(InvoiceItem).min(1, "Adicione ao menos um item").max(990, "Itens demais"),
    payments: z
      .array(z.object({ method: z.enum(Object.keys(PAYMENT_METHODS) as [PaymentCode, ...PaymentCode[]], "Forma de pagamento inválida"), amountCents: Cents("Pagamento") }))
      .min(1, "Informe a forma de pagamento")
      .max(100),
    notes: z.string().trim().max(2000, "Informações complementares muito longas").optional().default(""),
  })
  .superRefine((inv, ctx) => {
    const total = inv.items.reduce((acc, it) => acc + itemTotalCents(it), 0);
    const paid = inv.payments.reduce((acc, p) => acc + p.amountCents, 0);
    if (paid !== total) {
      ctx.addIssue({ code: "custom", path: ["payments"], message: "A soma dos pagamentos precisa ser igual ao total do cupom" });
    }
    if (inv.kind === "fiscal") {
      if (!inv.emitter.doc) ctx.addIssue({ code: "custom", path: ["emitter", "doc"], message: "Cupom fiscal: informe o CNPJ/CPF do emitente" });
      if (!inv.emitter.cityCode) ctx.addIssue({ code: "custom", path: ["emitter", "cityCode"], message: "Cupom fiscal: informe o código IBGE do município do emitente" });
      if (!inv.recipient.doc) ctx.addIssue({ code: "custom", path: ["recipient", "doc"], message: "Cupom fiscal: informe o CNPJ/CPF do destinatário" });
    }
    if (inv.accessKey) {
      const k = parseAccessKey(inv.accessKey);
      if (k && (k.model !== inv.model || k.series !== inv.series || k.number !== inv.number || (inv.emitter.doc && k.emitterDoc !== inv.emitter.doc.padStart(14, "0")))) {
        ctx.addIssue({ code: "custom", path: ["accessKey"], message: "A chave de acesso não confere com modelo/série/número/CNPJ do emitente" });
      }
    }
  });

/* ---------- Filtros de listagem / exportação (query string) ---------- */

const currentMonth = () => currentMonthKey();

export const ExpenseFilter = z.object({
  month: MonthKey.optional().transform((m) => m ?? currentMonth()),
  type: z.enum(EXPENSE_TYPES).optional(),
});

export const InvoiceFilter = z.object({
  month: MonthKey.optional().transform((m) => m ?? currentMonth()),
  kind: z.enum(["fiscal", "nao_fiscal"]).optional(),
});
