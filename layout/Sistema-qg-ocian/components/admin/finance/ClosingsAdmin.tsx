"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { api } from "@/lib/client";
import { currentMonthKey, formatWeekdayShort } from "@/lib/date";
import { CLOSING_METHODS, closingTotal, sumBy } from "@/lib/finance";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import type { ClosingRow, ClosingsResponse } from "@/lib/types";
import { ConfirmFooter, ExportButton, Field, FormError, MonthPicker, PageTitle, StatCard, inputClass } from "./ui";

type MethodKey = (typeof CLOSING_METHODS)[number]["key"];
type FormState = Record<MethodKey | "feesCents", string> & { notes: string };

const EMPTY_FORM: FormState = { debitCents: "", creditCents: "", pixCents: "", voucherCents: "", feesCents: "", notes: "" };

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-bold text-success">confere</span>;
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${diff > 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
      {diff > 0 ? "+" : "−"}
      {formatBRL(Math.abs(diff))}
    </span>
  );
}

export function ClosingsAdmin() {
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<ClosingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClosingRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ClosingRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<ClosingsResponse>(`/api/finance/closings?month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const closed = useMemo(() => (data?.rows ?? []).filter((r) => r.closing), [data]);
  const totals = useMemo(() => {
    const total = sumBy(closed, (r) => r.closing!.totalCents);
    const fees = sumBy(closed, (r) => r.closing!.feesCents);
    const withSaida = closed.filter((r) => r.saidaCents !== null);
    return {
      total,
      fees,
      net: total - fees,
      diff: sumBy(withSaida, (r) => r.closing!.totalCents - r.saidaCents!),
      byMethod: CLOSING_METHODS.map((m) => ({ ...m, cents: sumBy(closed, (r) => r.closing![m.key]) })),
    };
  }, [closed]);

  const open = (row: ClosingRow) => {
    const c = row.closing;
    setForm(
      c
        ? {
            debitCents: centsToInput(c.debitCents),
            creditCents: centsToInput(c.creditCents),
            pixCents: centsToInput(c.pixCents),
            voucherCents: centsToInput(c.voucherCents),
            feesCents: c.feesCents ? centsToInput(c.feesCents) : "",
            notes: c.notes,
          }
        : EMPTY_FORM,
    );
    setFormError(null);
    setEditing(row);
  };

  const parsed = useMemo(() => {
    const out: Partial<Record<MethodKey | "feesCents", number>> = {};
    for (const k of [...CLOSING_METHODS.map((m) => m.key), "feesCents"] as const) {
      const raw = form[k].trim();
      const v = raw === "" ? 0 : parseBRL(raw);
      if (v === null) return null;
      out[k] = v;
    }
    return out as Record<MethodKey | "feesCents", number>;
  }, [form]);

  const formTotal = parsed ? closingTotal(parsed) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!parsed) return setFormError("Algum valor está inválido. Ex.: 1.250,90");
    setSaving(true);
    setFormError(null);
    try {
      await api("/api/finance/closings", { method: "PUT", body: JSON.stringify({ date: editing.date, ...parsed, notes: form.notes }) });
      toast(`Fechamento de ${formatWeekdayShort(editing.date)} salvo.`);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await api(`/api/finance/closings?date=${removing.date}`, { method: "DELETE" });
      toast("Fechamento apagado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao apagar.", "error");
    }
    setRemoving(null);
    load();
  };

  const today = data?.today;
  const pendingToday = data?.rows.find((r) => r.date === today && !r.closing);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle subtitle="Financeiro" title="Fechamentos diários" />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <MonthPicker month={month} onChange={setMonth} />
          <ExportButton url={`/api/finance/closings/export?month=${month}`} label="Exportar Excel" />
        </div>
      </div>

      {pendingToday && (
        <button
          type="button"
          onClick={() => open(pendingToday)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand-soft px-4 py-3 text-left"
        >
          <span>
            <span className="block font-bold">Fechar a maquininha de hoje</span>
            <span className="text-sm text-muted">Lance débito, crédito, PIX e voucher do relatório da maquininha.</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-brand-ink">
            <Plus size={16} aria-hidden /> Lançar
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total na maquininha" value={formatBRL(totals.total)} tone="brand" hint={`${closed.length} dia(s) fechado(s)`} />
        <StatCard label="Líquido" value={formatBRL(totals.net)} hint={totals.fees ? `Taxas: ${formatBRL(totals.fees)}` : "Sem taxas lançadas"} />
        <StatCard
          label="Diferença x Saída"
          value={`${totals.diff > 0 ? "+" : totals.diff < 0 ? "−" : ""}${formatBRL(Math.abs(totals.diff))}`}
          tone={totals.diff < 0 ? "danger" : totals.diff > 0 ? "success" : "default"}
          hint="Maquininha menos o anotado na Saída"
        />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Por forma</p>
          <dl className="mt-1 space-y-0.5 text-sm">
            {totals.byMethod.map((m) => (
              <div key={m.key} className="flex justify-between gap-2">
                <dt className="text-muted">{m.label}</dt>
                <dd className="font-semibold tabular-nums">{formatBRL(m.cents)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">{error}</p>}
      {!data && !error && <div className="h-64 animate-pulse rounded-3xl bg-surface-2" />}
      {data && data.rows.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center text-muted">Esse mês ainda não começou.</div>
      )}

      {data && data.rows.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.rows.map((row) => {
            const c = row.closing;
            return (
              <li key={row.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="w-24 shrink-0">
                  <p className="font-bold capitalize">{formatWeekdayShort(row.date)}</p>
                  {row.date === today && <p className="text-xs font-semibold text-brand">hoje</p>}
                </div>
                <div className="min-w-0 flex-1">
                  {c ? (
                    <>
                      <p className="font-extrabold tabular-nums">{formatBRL(c.totalCents)}</p>
                      <p className="truncate text-xs text-muted tabular-nums">
                        {CLOSING_METHODS.filter((m) => c[m.key] > 0)
                          .map((m) => `${m.label} ${formatBRL(c[m.key])}`)
                          .join(" · ") || "Sem vendas"}
                        {c.notes && ` · ${c.notes}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Sem fechamento</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {c && row.saidaCents !== null && (
                    <span className="hidden text-xs text-muted sm:inline" title="Total anotado na aba Saída">
                      Saída {formatBRL(row.saidaCents)}
                    </span>
                  )}
                  {c && row.saidaCents !== null && <DiffBadge diff={c.totalCents - row.saidaCents} />}
                  {c ? (
                    <>
                      <button
                        type="button"
                        onClick={() => open(row)}
                        aria-label={`Editar fechamento de ${formatWeekdayShort(row.date)}`}
                        className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                      >
                        <Pencil size={18} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoving(row)}
                        aria-label={`Apagar fechamento de ${formatWeekdayShort(row.date)}`}
                        className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={18} aria-hidden />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => open(row)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                    >
                      <Plus size={16} aria-hidden /> Lançar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!editing}
        title={editing ? `Fechamento · ${formatWeekdayShort(editing.date)}` : "Fechamento"}
        onClose={saving ? () => undefined : () => setEditing(null)}
        footer={<ConfirmFooter onCancel={() => setEditing(null)} confirmLabel="Salvar fechamento" busy={saving} formId="closing-form" />}
      >
        <form id="closing-form" onSubmit={save} className="space-y-4">
          <p className="text-sm text-muted">Copie os valores do relatório da maquininha. Campos vazios contam como zero.</p>
          <div className="grid grid-cols-2 gap-3">
            {CLOSING_METHODS.map((m) => (
              <Field key={m.key} label={`${m.label} (R$)`}>
                <input
                  className={`${inputClass} tabular-nums`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form[m.key]}
                  onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="font-semibold">Total na maquininha</span>
            <span className="text-xl font-extrabold tabular-nums">{formTotal === null ? "—" : formatBRL(formTotal)}</span>
          </div>
          {editing?.saidaCents !== null && editing?.saidaCents !== undefined && formTotal !== null && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Anotado na Saída: <strong className="tabular-nums text-ink">{formatBRL(editing.saidaCents)}</strong>
              <DiffBadge diff={formTotal - editing.saidaCents} />
            </p>
          )}
          <Field label="Taxas da maquininha (opcional)">
            <input
              className={`${inputClass} tabular-nums`}
              inputMode="decimal"
              placeholder="0,00"
              value={form.feesCents}
              onChange={(e) => setForm({ ...form, feesCents: e.target.value })}
            />
          </Field>
          <Field label="Observação">
            <textarea
              className={`${inputClass} min-h-20`}
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex.: maquininha 2 ficou sem sinal à tarde"
            />
          </Field>
          <FormError message={formError} />
        </form>
      </Modal>

      <Modal
        open={!!removing}
        title="Apagar fechamento?"
        onClose={() => setRemoving(null)}
        footer={<ConfirmFooter onCancel={() => setRemoving(null)} onConfirm={confirmRemove} confirmLabel="Apagar" danger />}
      >
        <p>
          O fechamento de <strong>{removing && formatWeekdayShort(removing.date)}</strong> (
          {removing?.closing && formatBRL(removing.closing.totalCents)}) será apagado. Você pode lançar de novo depois.
        </p>
      </Modal>
    </div>
  );
}
