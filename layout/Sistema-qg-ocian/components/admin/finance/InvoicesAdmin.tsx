"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, FileCode2, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { api, download, post } from "@/lib/client";
import { currentMonthKey, formatDateBR, todayKey } from "@/lib/date";
import { sumBy } from "@/lib/finance";
import { PAYMENT_METHODS, formatDoc, type PaymentCode } from "@/lib/fiscal";
import { formatBRL } from "@/lib/money";
import type { InvoiceDTO, InvoiceKind, InvoicesResponse } from "@/lib/types";
import { InvoiceForm, type InvoicePayload } from "./InvoiceForm";
import { ConfirmFooter, ExportButton, MonthPicker, PageTitle, StatCard } from "./ui";

type Filter = InvoiceKind | "all";

export function InvoicesAdmin() {
  const [month, setMonth] = useState(currentMonthKey);
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceDTO | null>(null);
  const [removing, setRemoving] = useState<InvoiceDTO | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<InvoicesResponse>(`/api/finance/invoices?month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const all = useMemo(() => data?.invoices ?? [], [data]);
  const visible = filter === "all" ? all : all.filter((i) => i.kind === filter);
  const fiscal = all.filter((i) => i.kind === "fiscal");
  const naoFiscal = all.filter((i) => i.kind === "nao_fiscal");

  const save = async (payload: InvoicePayload) => {
    if (editing?.id) await api(`/api/finance/invoices/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await post("/api/finance/invoices", payload);
    toast(editing?.id ? "Cupom atualizado." : "Cupom cadastrado.");
    setFormOpen(false);
    if (payload.issueDate.slice(0, 7) !== month) setMonth(payload.issueDate.slice(0, 7));
    else load();
  };

  /** Duplicar: abre um cupom novo com o mesmo emitente, itens e pagamento (compras que se repetem). */
  const duplicate = (inv: InvoiceDTO) => {
    setEditing({ ...inv, id: "", number: inv.number + 1, accessKey: "", issueDate: todayKey() });
    setFormOpen(true);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await api(`/api/finance/invoices/${removing.id}`, { method: "DELETE" });
      toast("Cupom apagado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao apagar.", "error");
    }
    setRemoving(null);
    load();
  };

  const downloadXml = async (inv: InvoiceDTO) => {
    try {
      await download(`/api/finance/invoices/${inv.id}/xml`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao gerar o XML.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle subtitle="Financeiro" title="Cupons fiscais e não fiscais" />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <MonthPicker month={month} onChange={setMonth} />
          <ExportButton url={`/api/finance/invoices/export?month=${month}${filter === "all" ? "" : `&kind=${filter}`}`} label="XMLs do mês (.zip)" />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-bold text-brand-ink"
          >
            <Plus size={18} aria-hidden /> Novo cupom
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total do mês" value={formatBRL(sumBy(all, (i) => i.totalCents))} tone="brand" hint={`${all.length} cupom(ns)`} />
        <StatCard label="Fiscais" value={formatBRL(sumBy(fiscal, (i) => i.totalCents))} hint={`${fiscal.length} cupom(ns)`} />
        <StatCard label="Não fiscais" value={formatBRL(sumBy(naoFiscal, (i) => i.totalCents))} hint={`${naoFiscal.length} cupom(ns)`} />
      </div>

      <div className="flex gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="Filtrar por tipo">
        {(
          [
            ["all", "Todos"],
            ["fiscal", "Fiscais"],
            ["nao_fiscal", "Não fiscais"],
          ] as const
        ).map(([key, label]) => (
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
          <p className="text-lg font-bold">Nenhum cupom neste mês</p>
          <p className="text-muted">Cadastre as notas e cupons recebidos; o XML sai no mesmo layout que você envia ao contador.</p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{inv.emitter.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                      inv.kind === "fiscal" ? "bg-success-soft text-success" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {inv.kind === "fiscal" ? "Fiscal" : "Não fiscal"}
                  </span>
                </p>
                <p className="truncate text-xs text-muted tabular-nums">
                  {formatDateBR(inv.issueDate)} · {inv.model === "65" ? "NFC-e" : "NF-e"} nº {inv.number} série {inv.series}
                  {inv.emitter.doc && ` · ${formatDoc(inv.emitter.doc)}`}
                  {` · ${inv.payments.map((p) => PAYMENT_METHODS[p.method as PaymentCode] ?? p.method).join(" + ")}`}
                </p>
              </div>
              <p className="font-extrabold tabular-nums">{formatBRL(inv.totalCents)}</p>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => downloadXml(inv)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={`Baixar XML do cupom ${inv.number} de ${inv.emitter.name}`}
                >
                  <FileCode2 size={18} aria-hidden /> XML
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(inv)}
                  aria-label={`Duplicar cupom ${inv.number} de ${inv.emitter.name}`}
                  title="Duplicar"
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Copy size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(inv);
                    setFormOpen(true);
                  }}
                  aria-label={`Editar cupom ${inv.number} de ${inv.emitter.name}`}
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Pencil size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(inv)}
                  aria-label={`Apagar cupom ${inv.number} de ${inv.emitter.name}`}
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between bg-surface-2 px-4 py-3 font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{formatBRL(sumBy(visible, (i) => i.totalCents))}</span>
          </li>
        </ul>
      )}

      <InvoiceForm
        open={formOpen}
        initial={editing}
        emitters={data?.emitters ?? []}
        lastRecipient={data?.lastRecipient ?? null}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />

      <Modal
        open={!!removing}
        title="Apagar cupom?"
        onClose={() => setRemoving(null)}
        footer={<ConfirmFooter onCancel={() => setRemoving(null)} onConfirm={confirmRemove} confirmLabel="Apagar" danger />}
      >
        <p>
          O cupom nº <strong>{removing?.number}</strong> de <strong>{removing?.emitter.name}</strong> (
          {removing && formatBRL(removing.totalCents)}) será apagado.
        </p>
      </Modal>
    </div>
  );
}
