"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Package, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { api, post } from "@/lib/client";
import { currentMonthKey, formatWeekdayShort, todayKey } from "@/lib/date";
import { EXPENSE_PAYMENT_LABELS, EXPENSE_TYPE_LABELS, sumBy } from "@/lib/finance";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import type { ExpenseDTO, ExpensePayment, ExpenseType, ExpensesResponse } from "@/lib/types";
import { ConfirmFooter, ExportButton, Field, FormError, MonthPicker, PageTitle, StatCard, inputClass } from "./ui";

const TYPES: { key: ExpenseType; icon: typeof Receipt }[] = [
  { key: "despesa", icon: Receipt },
  { key: "cartao", icon: CreditCard },
  { key: "suprimento", icon: Package },
];

/** Sugestões iniciais de categoria (somam-se às já usadas). */
const CATEGORY_HINTS: Record<ExpenseType, string[]> = {
  despesa: ["Aluguel", "Energia", "Água", "Internet", "Gás", "Salários", "Impostos", "Contador", "Manutenção"],
  cartao: ["Mercado", "Equipamentos", "Assinaturas", "Combustível"],
  suprimento: ["Embalagens", "Descartáveis", "Limpeza", "Ingredientes", "Bebidas"],
};

type Form = {
  type: ExpenseType;
  date: string;
  description: string;
  amount: string;
  category: string;
  supplier: string;
  paymentMethod: ExpensePayment;
  installments: string;
  notes: string;
};

const newForm = (type: ExpenseType = "despesa"): Form => ({
  type,
  date: todayKey(),
  description: "",
  amount: "",
  category: "",
  supplier: "",
  paymentMethod: type === "cartao" ? "credito" : "pix",
  installments: "1",
  notes: "",
});

export function ExpensesAdmin() {
  const [month, setMonth] = useState(currentMonthKey);
  const [filter, setFilter] = useState<ExpenseType | "all">("all");
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(newForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ExpenseDTO | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<ExpensesResponse>(`/api/finance/expenses?month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const all = useMemo(() => data?.expenses ?? [], [data]);
  const visible = filter === "all" ? all : all.filter((e) => e.type === filter);
  const byType = useMemo(
    () => Object.fromEntries(TYPES.map((t) => [t.key, sumBy(all.filter((e) => e.type === t.key), (e) => e.amountCents)])) as Record<ExpenseType, number>,
    [all],
  );
  const total = sumBy(all, (e) => e.amountCents);

  const categories = useMemo(
    () => [...new Set([...(CATEGORY_HINTS[form.type] ?? []), ...(data?.categories ?? [])])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [form.type, data],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(newForm(filter === "all" ? "despesa" : filter));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (e: ExpenseDTO) => {
    setEditingId(e.id);
    setForm({
      type: e.type,
      date: e.date,
      description: e.description,
      amount: centsToInput(e.amountCents),
      category: e.category,
      supplier: e.supplier,
      paymentMethod: e.paymentMethod,
      installments: String(e.installments),
      notes: e.notes,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const setType = (type: ExpenseType) =>
    setForm((f) => ({ ...f, type, paymentMethod: type === "cartao" ? "credito" : f.paymentMethod === "credito" && f.type === "cartao" ? "pix" : f.paymentMethod }));

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const amountCents = parseBRL(form.amount);
    if (!amountCents) return setFormError("Valor inválido. Ex.: 89,90");
    const body = {
      type: form.type,
      date: form.date,
      description: form.description,
      amountCents,
      category: form.category,
      supplier: form.supplier,
      paymentMethod: form.paymentMethod,
      installments: Number.parseInt(form.installments, 10) || 1,
      notes: form.notes,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) await api(`/api/finance/expenses/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
      else await post("/api/finance/expenses", body);
      toast(editingId ? "Lançamento atualizado." : "Lançamento registrado.");
      setFormOpen(false);
      if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
      else load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await api(`/api/finance/expenses/${removing.id}`, { method: "DELETE" });
      toast("Lançamento apagado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao apagar.", "error");
    }
    setRemoving(null);
    load();
  };

  const isCredit = form.type === "cartao" || form.paymentMethod === "credito";
  const installments = Number.parseInt(form.installments, 10) || 1;
  const amountPreview = parseBRL(form.amount);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle subtitle="Financeiro" title="Despesas e compras" />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <MonthPicker month={month} onChange={setMonth} />
          <ExportButton url={`/api/finance/expenses/export?month=${month}${filter === "all" ? "" : `&type=${filter}`}`} label="Exportar Excel" />
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-bold text-brand-ink">
            <Plus size={18} aria-hidden /> Novo lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total do mês" value={formatBRL(total)} tone="brand" hint={`${all.length} lançamento(s)`} />
        {TYPES.map((t) => (
          <StatCard key={t.key} label={EXPENSE_TYPE_LABELS[t.key]} value={formatBRL(byType[t.key])} />
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por tipo">
        {([["all", "Todos"], ...TYPES.map((t) => [t.key, EXPENSE_TYPE_LABELS[t.key]])] as [ExpenseType | "all", string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${filter === key ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">{error}</p>}
      {!data && !error && <div className="h-48 animate-pulse rounded-3xl bg-surface-2" />}
      {data && visible.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-lg font-bold">Nenhum lançamento neste mês</p>
          <p className="text-muted">Registre contas, compras no cartão de crédito e suprimentos da loja.</p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((e) => {
            const Icon = TYPES.find((t) => t.key === e.type)!.icon;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted sm:grid" title={EXPENSE_TYPE_LABELS[e.type]}>
                  <Icon size={20} aria-hidden />
                  <span className="sr-only">{EXPENSE_TYPE_LABELS[e.type]}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold sm:truncate">{e.description}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="capitalize">{formatWeekdayShort(e.date)}</span>
                    {e.category && ` · ${e.category}`}
                    {e.supplier && ` · ${e.supplier}`}
                    {` · ${EXPENSE_PAYMENT_LABELS[e.paymentMethod]}`}
                    {e.installments > 1 && ` ${e.installments}x`}
                  </p>
                </div>
                <p className="shrink-0 font-extrabold tabular-nums">{formatBRL(e.amountCents)}</p>
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  aria-label={`Editar ${e.description}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Pencil size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(e)}
                  aria-label={`Apagar ${e.description}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-between bg-surface-2 px-4 py-3 font-extrabold">
            <span>Total {filter !== "all" && `· ${EXPENSE_TYPE_LABELS[filter]}`}</span>
            <span className="tabular-nums">{formatBRL(sumBy(visible, (e) => e.amountCents))}</span>
          </li>
        </ul>
      )}

      <Modal
        open={formOpen}
        title={editingId ? "Editar lançamento" : "Novo lançamento"}
        onClose={saving ? () => undefined : () => setFormOpen(false)}
        footer={<ConfirmFooter onCancel={() => setFormOpen(false)} confirmLabel={editingId ? "Salvar alterações" : "Registrar"} busy={saving} formId="expense-form" />}
      >
        <form id="expense-form" onSubmit={save} className="space-y-4">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Tipo</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPES.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  aria-pressed={form.type === key}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold sm:text-sm ${
                    form.type === key ? "border-brand bg-brand-soft text-ink" : "border-line bg-bg text-muted hover:bg-surface-2"
                  }`}
                >
                  <Icon size={18} aria-hidden />
                  {EXPENSE_TYPE_LABELS[key]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Descrição">
            <input
              className={inputClass}
              required
              maxLength={120}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={form.type === "suprimento" ? "Ex.: Copos 300ml (50 un.)" : form.type === "cartao" ? "Ex.: Liquidificador industrial" : "Ex.: Conta de luz"}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <input
                className={`${inputClass} tabular-nums`}
                inputMode="decimal"
                required
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Data">
              <input className={inputClass} type="date" required max={todayKey()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <input
                className={inputClass}
                list="expense-categories"
                maxLength={40}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Opcional"
              />
              <datalist id="expense-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Fornecedor / loja">
              <input
                className={inputClass}
                list="expense-suppliers"
                maxLength={80}
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Opcional"
              />
              <datalist id="expense-suppliers">
                {(data?.suppliers ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma de pagamento">
              <select
                className={inputClass}
                value={form.type === "cartao" ? "credito" : form.paymentMethod}
                disabled={form.type === "cartao"}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as ExpensePayment })}
              >
                {(Object.keys(EXPENSE_PAYMENT_LABELS) as ExpensePayment[]).map((p) => (
                  <option key={p} value={p}>
                    {EXPENSE_PAYMENT_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            {isCredit && (
              <Field label="Parcelas">
                <select className={inputClass} value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "À vista" : `${n}x`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {isCredit && installments > 1 && amountPreview ? (
            <p className="text-sm text-muted">
              {installments}x de <strong className="tabular-nums text-ink">{formatBRL(Math.round(amountPreview / installments))}</strong> · o lançamento
              fica com o valor total na data da compra.
            </p>
          ) : null}

          <Field label="Observação">
            <textarea className={`${inputClass} min-h-16`} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <FormError message={formError} />
        </form>
      </Modal>

      <Modal
        open={!!removing}
        title="Apagar lançamento?"
        onClose={() => setRemoving(null)}
        footer={<ConfirmFooter onCancel={() => setRemoving(null)} onConfirm={confirmRemove} confirmLabel="Apagar" danger />}
      >
        <p>
          <strong>{removing?.description}</strong> ({removing && formatBRL(removing.amountCents)}) será apagado.
        </p>
      </Modal>
    </div>
  );
}
