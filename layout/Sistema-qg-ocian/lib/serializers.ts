import type { ProductRecord } from "@/models/Product";
import type { DailyRegisterRecord, RegisterItemRecord } from "@/models/DailyRegister";
import type { CardClosingRecord } from "@/models/CardClosing";
import type { ExpenseRecord } from "@/models/Expense";
import type { InvoiceRecord } from "@/models/Invoice";
import type {
  ClosingDTO,
  ExpenseDTO,
  InvoiceDTO,
  PartyDTO,
  ProductDTO,
  RegisterDTO,
  RegisterItemDTO,
} from "./types";

export function toProductDTO(p: ProductRecord): ProductDTO {
  return {
    id: String(p._id),
    name: p.name,
    category: p.category,
    priceCents: p.priceCents,
    emoji: p.emoji ?? "",
    active: p.active,
    sortOrder: p.sortOrder ?? 0,
  };
}

export function toItemDTO(i: RegisterItemRecord): RegisterItemDTO {
  return {
    productId: String(i.productId),
    name: i.name,
    category: i.category,
    emoji: i.emoji ?? "",
    priceCents: i.priceCents,
    qty: i.qty,
  };
}

export function computeTotals(items: { priceCents: number; qty: number }[]) {
  return items.reduce(
    (acc, i) => ({ totalCents: acc.totalCents + i.priceCents * i.qty, totalItems: acc.totalItems + i.qty }),
    { totalCents: 0, totalItems: 0 },
  );
}

/** Para dias abertos, os totais são calculados na hora a partir dos itens. */
export function toRegisterDTO(r: DailyRegisterRecord): RegisterDTO {
  const items = r.items.map(toItemDTO).filter((i) => i.qty > 0);
  const totals = r.status === "closed" ? { totalCents: r.totalCents, totalItems: r.totalItems } : computeTotals(items);
  return {
    date: r.date,
    status: r.status,
    items,
    ...totals,
    notes: r.notes ?? "",
    closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : null,
  };
}

export function emptyRegister(date: string): RegisterDTO {
  return { date, status: "open", items: [], totalCents: 0, totalItems: 0, notes: "", closedAt: null };
}

/* ===================== Financeiro ===================== */

export function toClosingDTO(c: CardClosingRecord): ClosingDTO {
  return {
    date: c.date,
    debitCents: c.debitCents,
    creditCents: c.creditCents,
    pixCents: c.pixCents,
    voucherCents: c.voucherCents,
    feesCents: c.feesCents ?? 0,
    totalCents: c.totalCents,
    notes: c.notes ?? "",
  };
}

export function toExpenseDTO(e: ExpenseRecord): ExpenseDTO {
  return {
    id: String(e._id),
    date: e.date,
    type: e.type,
    category: e.category ?? "",
    description: e.description,
    supplier: e.supplier ?? "",
    amountCents: e.amountCents,
    paymentMethod: e.paymentMethod,
    installments: e.installments ?? 1,
    notes: e.notes ?? "",
  };
}

export function toPartyDTO(p: PartyDTO): PartyDTO {
  return {
    doc: p.doc ?? "",
    name: p.name,
    ie: p.ie ?? "",
    crt: p.crt ?? "3",
    ieIndicator: p.ieIndicator ?? "9",
    street: p.street ?? "",
    number: p.number ?? "",
    district: p.district ?? "",
    cityCode: p.cityCode ?? "",
    city: p.city ?? "",
    uf: p.uf,
    cep: p.cep ?? "",
    phone: p.phone ?? "",
  };
}

export function toInvoiceDTO(i: InvoiceRecord): InvoiceDTO {
  return {
    id: String(i._id),
    kind: i.kind,
    model: i.model,
    series: i.series,
    number: i.number,
    issueDate: i.issueDate,
    issueTime: i.issueTime ?? "00:00",
    natOp: i.natOp ?? "VENDA",
    accessKey: i.accessKey ?? "",
    cNF: i.cNF,
    emitter: toPartyDTO(i.emitter),
    recipient: toPartyDTO(i.recipient),
    items: i.items.map((it) => ({
      code: it.code ?? "",
      ean: it.ean ?? "",
      description: it.description,
      ncm: it.ncm ?? "00000000",
      cest: it.cest ?? "",
      cfop: it.cfop ?? "",
      unit: it.unit ?? "un",
      qty: it.qty,
      unitCents: it.unitCents,
      totalCents: it.totalCents,
    })),
    payments: i.payments.map((p) => ({ method: p.method, amountCents: p.amountCents })),
    totalCents: i.totalCents,
    notes: i.notes ?? "",
  };
}
