/**
 * Consultas e planilhas do financeiro (servidor). As rotas em app/api/finance só validam e chamam daqui.
 */
import { connectDB } from "./db";
import { formatMonth, formatWeekdayShort, monthRange, todayKey } from "./date";
import { EXPENSE_PAYMENT_LABELS, EXPENSE_TYPE_LABELS, buildClosingRows, sumBy } from "./finance";
import { formatDoc, invoiceKey, PAYMENT_METHODS, type PaymentCode } from "./fiscal";
import { toClosingDTO, toExpenseDTO, toInvoiceDTO, toPartyDTO, toRegisterDTO } from "./serializers";
import type { ClosingsResponse, ExpenseType, ExpensesResponse, InvoiceKind, InvoicesResponse, PartyDTO } from "./types";
import { buildSheet } from "./xlsx";
import { CardClosing, type CardClosingRecord } from "@/models/CardClosing";
import { DailyRegister, type DailyRegisterRecord } from "@/models/DailyRegister";
import { Expense, type ExpenseRecord } from "@/models/Expense";
import { Invoice, type InvoiceRecord } from "@/models/Invoice";

const generatedAt = () =>
  `Gerado em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date())}`;

/* ---------------- Fechamentos da maquininha ---------------- */

export async function getClosingsMonth(month: string): Promise<ClosingsResponse> {
  const { from, to } = monthRange(month);
  await connectDB();
  const [closings, registers] = await Promise.all([
    CardClosing.find({ date: { $gte: from, $lte: to } }).lean<CardClosingRecord[]>(),
    DailyRegister.find({ date: { $gte: from, $lte: to } }).lean<DailyRegisterRecord[]>(),
  ]);
  const saida = new Map(registers.map((r) => [r.date, toRegisterDTO(r).totalCents]));
  const today = todayKey();
  return { month, today, rows: buildClosingRows(month, closings.map(toClosingDTO), saida, today) };
}

export async function closingsSheet(month: string): Promise<Buffer> {
  const { rows } = await getClosingsMonth(month);
  const data = rows
    .filter((r) => r.closing)
    .reverse()
    .map(({ date, closing: c, saidaCents }) => ({
      date,
      weekday: formatWeekdayShort(date).split(",")[0],
      debit: c!.debitCents,
      credit: c!.creditCents,
      pix: c!.pixCents,
      voucher: c!.voucherCents,
      total: c!.totalCents,
      fees: c!.feesCents,
      net: c!.totalCents - c!.feesCents,
      saida: saidaCents ?? 0,
      diff: c!.totalCents - (saidaCents ?? 0),
      notes: c!.notes,
    }));
  return buildSheet({
    sheetName: "Fechamentos",
    title: `QG Ocian — Fechamentos da maquininha · ${formatMonth(month)}`,
    subtitle: `${data.length} dia(s) fechado(s) · ${generatedAt()}`,
    columns: [
      { header: "Data", key: "date", type: "date", width: 12 },
      { header: "Dia", key: "weekday", width: 7 },
      { header: "Débito", key: "debit", type: "money", total: true, width: 14 },
      { header: "Crédito", key: "credit", type: "money", total: true, width: 14 },
      { header: "PIX", key: "pix", type: "money", total: true, width: 14 },
      { header: "Voucher", key: "voucher", type: "money", total: true, width: 14 },
      { header: "Total maquininha", key: "total", type: "money", total: true, width: 18 },
      { header: "Taxas", key: "fees", type: "money", total: true, width: 12 },
      { header: "Líquido", key: "net", type: "money", total: true, width: 16 },
      { header: "Anotado na Saída", key: "saida", type: "money", total: true, width: 18 },
      { header: "Diferença", key: "diff", type: "money", total: true, width: 14 },
      { header: "Observação", key: "notes", width: 40 },
    ],
    rows: data,
  });
}

/* ---------------- Despesas ---------------- */

export async function getExpensesMonth(month: string, type?: ExpenseType): Promise<ExpensesResponse> {
  const { from, to } = monthRange(month);
  await connectDB();
  const filter = { date: { $gte: from, $lte: to }, ...(type ? { type } : {}) };
  const [docs, categories, suppliers] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).lean<ExpenseRecord[]>(),
    Expense.distinct("category"),
    Expense.distinct("supplier"),
  ]);
  const clean = (list: unknown[]) => (list.filter((v) => typeof v === "string" && v) as string[]).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { month, expenses: docs.map(toExpenseDTO), categories: clean(categories), suppliers: clean(suppliers) };
}

export async function expensesSheet(month: string, type?: ExpenseType): Promise<Buffer> {
  const { expenses } = await getExpensesMonth(month, type);
  const list = [...expenses].reverse();
  const label = type ? EXPENSE_TYPE_LABELS[type] : "Despesas, cartão de crédito e suprimentos";
  return buildSheet({
    sheetName: "Despesas",
    title: `QG Ocian — ${label} · ${formatMonth(month)}`,
    subtitle: `${list.length} lançamento(s) · ${generatedAt()}`,
    columns: [
      { header: "Data", key: "date", type: "date", width: 12 },
      { header: "Tipo", key: "type", width: 18 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Descrição", key: "description", width: 36 },
      { header: "Fornecedor", key: "supplier", width: 24 },
      { header: "Pagamento", key: "payment", width: 16 },
      { header: "Parcelas", key: "installments", type: "int", width: 10 },
      { header: "Valor", key: "amount", type: "money", total: true, width: 16 },
      { header: "Observação", key: "notes", width: 36 },
    ],
    rows: list.map((e) => ({
      date: e.date,
      type: EXPENSE_TYPE_LABELS[e.type],
      category: e.category,
      description: e.description,
      supplier: e.supplier,
      payment: EXPENSE_PAYMENT_LABELS[e.paymentMethod],
      installments: e.installments,
      amount: e.amountCents,
      notes: e.notes,
    })),
    summary: type
      ? undefined
      : (Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]).map((t) => ({
          label: EXPENSE_TYPE_LABELS[t],
          cents: sumBy(
            list.filter((e) => e.type === t),
            (e) => e.amountCents,
          ),
        })),
  });
}

/* ---------------- Cupons ---------------- */

export async function getInvoicesMonth(month: string, kind?: InvoiceKind): Promise<InvoicesResponse> {
  const { from, to } = monthRange(month);
  await connectDB();
  const filter = { issueDate: { $gte: from, $lte: to }, ...(kind ? { kind } : {}) };
  const [docs, emitters, last] = await Promise.all([
    Invoice.find(filter).sort({ issueDate: -1, issueTime: -1 }).lean<InvoiceRecord[]>(),
    // último cadastro de cada emitente, para preencher o formulário
    Invoice.aggregate<{ emitter: PartyDTO }>([
      { $sort: { updatedAt: -1 } },
      { $group: { _id: { $cond: [{ $eq: ["$emitter.doc", ""] }, "$emitter.name", "$emitter.doc"] }, emitter: { $first: "$emitter" } } },
      { $sort: { "emitter.name": 1 } },
      { $limit: 300 },
    ]),
    Invoice.findOne().sort({ updatedAt: -1 }).select({ recipient: 1 }).lean<Pick<InvoiceRecord, "recipient">>(),
  ]);
  return {
    month,
    invoices: docs.map(toInvoiceDTO),
    emitters: emitters.map((e) => toPartyDTO(e.emitter)),
    lastRecipient: last ? toPartyDTO(last.recipient) : null,
  };
}

/** Planilha-resumo que vai junto no .zip dos XMLs do mês. */
export async function invoicesSheet(month: string, kind?: InvoiceKind): Promise<Buffer> {
  const { invoices } = await getInvoicesMonth(month, kind);
  const list = [...invoices].reverse();
  return buildSheet({
    sheetName: "Cupons",
    title: `QG Ocian — Cupons fiscais e não fiscais · ${formatMonth(month)}`,
    subtitle: `${list.length} documento(s) · ${generatedAt()}`,
    columns: [
      { header: "Emissão", key: "date", type: "date", width: 12 },
      { header: "Tipo", key: "kind", width: 12 },
      { header: "Modelo", key: "model", width: 8 },
      { header: "Série", key: "series", type: "int", width: 7 },
      { header: "Número", key: "number", type: "int", width: 11 },
      { header: "Emitente", key: "emitter", width: 30 },
      { header: "CNPJ/CPF", key: "doc", width: 20 },
      { header: "Pagamento", key: "payment", width: 20 },
      { header: "Valor", key: "total", type: "money", total: true, width: 14 },
      { header: "Chave de acesso", key: "key", width: 48 },
    ],
    rows: list.map((i) => ({
      date: i.issueDate,
      kind: i.kind === "fiscal" ? "Fiscal" : "Não fiscal",
      model: i.model === "65" ? "NFC-e" : "NF-e",
      series: i.series,
      number: i.number,
      emitter: i.emitter.name,
      doc: i.emitter.doc ? formatDoc(i.emitter.doc) : "",
      payment: i.payments.map((p) => PAYMENT_METHODS[p.method as PaymentCode] ?? p.method).join(", "),
      total: i.totalCents,
      key: invoiceKey(i),
    })),
  });
}

