"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, Printer, RefreshCw } from "lucide-react";
import { api, post } from "@/lib/client";
import { formatLongDate, formatTime } from "@/lib/date";
import { formatBRL } from "@/lib/money";
import type { SaleDTO, SalesDayResponse } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { FISCAL_LABELS, methodLabel, receiptHref, saleNumber } from "./labels";

const FISCAL_MIN_REASON = 15;

export function SalesDay({ role }: { role: "admin" | "staff" }) {
  const [date, setDate] = useState<string | null>(null); // null = hoje
  const [data, setData] = useState<SalesDayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<SaleDTO | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async (d: string | null) => {
    try {
      setError(null);
      setData(await api<SalesDayResponse>(`/api/vendas${d ? `?date=${d}` : ""}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [load, date]);

  const replace = (sale: SaleDTO) => setData((d) => (d ? { ...d, sales: d.sales.map((s) => (s.id === sale.id ? sale : s)) } : d));

  const retry = async (sale: SaleDTO) => {
    setRetrying(sale.id);
    try {
      const res = await post<{ sale: SaleDTO }>(`/api/vendas/${sale.id}/fiscal/retry`, {});
      replace(res.sale);
      const f = res.sale.fiscal!;
      toast(f.status === "autorizada" ? "NFC-e autorizada." : `${FISCAL_LABELS[f.status]}: ${f.message}`, f.status === "autorizada" ? "success" : "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível reenviar.", "error");
    } finally {
      setRetrying(null);
    }
  };

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto text-danger" aria-hidden />
        <p className="mt-2 font-semibold">{error}</p>
        <button onClick={() => load(date)} className="mt-4 rounded-xl bg-ink px-4 py-2 font-semibold text-bg">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" aria-label="Carregando" />;

  const isToday = data.date === data.today;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{isToday ? "Vendas de hoje" : "Vendas do dia"}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{formatLongDate(data.date)}</h1>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Dia</span>
          <input
            type="date"
            value={data.date}
            max={data.today}
            onChange={(e) => e.target.value && setDate(e.target.value === data.today ? null : e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
      </div>

      <section aria-label="Totais do dia" className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-muted">Vendas</p>
            <p className="text-lg font-bold tabular-nums">{data.totals.count}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-muted">Total (sem canceladas)</p>
            <p className="text-2xl font-extrabold tabular-nums">{formatBRL(data.totals.totalCents)}</p>
          </div>
        </div>
        {data.totals.byMethod.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {data.totals.byMethod.map((m) => (
              <li key={m.method} className="rounded-lg bg-surface-2 px-2.5 py-1">
                {methodLabel(m.method)} <strong className="tabular-nums">{formatBRL(m.amountCents)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.sales.length === 0 ? (
        <p className="py-10 text-center text-muted">Nenhuma venda neste dia.</p>
      ) : (
        <ul className="space-y-2">
          {data.sales.map((s) => {
            const canceled = s.status === "cancelada";
            const f = s.fiscal;
            const fiscalPending = !canceled && f && f.status !== "autorizada" && f.status !== "cancelada";
            return (
              <li key={s.id} className={`rounded-2xl border border-line bg-surface p-3 ${canceled ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      <span className="tabular-nums">nº {saleNumber(s.number)}</span>
                      <span className="ml-2 text-sm font-medium text-muted">{formatTime(s.createdAt)}</span>
                    </p>
                    <p className={`text-sm text-muted ${canceled ? "line-through" : ""}`}>
                      {s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold">{s.payments.map((p) => methodLabel(p.method)).join(" + ")}</span>
                      <span className={`rounded-md px-2 py-0.5 font-semibold ${f ? (f.status === "autorizada" ? "bg-success-soft text-success" : f.status === "cancelada" ? "bg-surface-2 text-muted" : "bg-danger-soft text-danger") : "bg-surface-2 text-muted"}`}>
                        {f ? FISCAL_LABELS[f.status] : "Não fiscal"}
                      </span>
                      {canceled && <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">Cancelada</span>}
                    </p>
                    {fiscalPending && f.message && <p className="mt-1 text-xs text-danger">{f.message}</p>}
                    {canceled && s.cancelReason && <p className="mt-1 text-xs text-muted">Motivo: {s.cancelReason}</p>}
                  </div>
                  <p className={`text-lg font-extrabold tabular-nums ${canceled ? "line-through" : ""}`}>{formatBRL(s.totalCents)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={receiptHref(s)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
                  >
                    <Printer size={15} aria-hidden /> Reimprimir
                  </a>
                  {fiscalPending && (
                    <button
                      type="button"
                      onClick={() => retry(s)}
                      disabled={retrying === s.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
                    >
                      <RefreshCw size={15} aria-hidden className={retrying === s.id ? "animate-spin" : ""} /> Tentar de novo
                    </button>
                  )}
                  {!canceled && (role === "admin" || isToday) && (
                    <button
                      type="button"
                      onClick={() => setCanceling(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Ban size={15} aria-hidden /> Cancelar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CancelDialog
        sale={canceling}
        onClose={() => setCanceling(null)}
        onCanceled={(sale) => {
          setCanceling(null);
          replace(sale);
          load(date);
          toast(`Venda nº ${saleNumber(sale.number)} cancelada.`);
        }}
      />
    </div>
  );
}

function CancelDialog({ sale, onClose, onCanceled }: { sale: SaleDTO | null; onClose: () => void; onCanceled: (s: SaleDTO) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(""), [sale]);

  const fiscal = sale?.fiscal?.status === "autorizada";
  const min = fiscal ? FISCAL_MIN_REASON : 3;
  const ok = reason.trim().length >= min;

  const confirm = async () => {
    if (!sale || !ok) return;
    setBusy(true);
    try {
      const res = await post<{ sale: SaleDTO }>(`/api/vendas/${sale.id}/cancel`, { reason: reason.trim() });
      onCanceled(res.sale);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível cancelar.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!sale}
      title={sale ? `Cancelar venda nº ${saleNumber(sale.number)}` : "Cancelar venda"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-surface-2">
            Voltar
          </button>
          <button type="button" onClick={confirm} disabled={!ok || busy} className="flex-1 rounded-xl bg-danger px-4 py-2.5 font-bold text-white disabled:opacity-40">
            {busy ? "Cancelando…" : "Cancelar venda"}
          </button>
        </>
      }
    >
      {sale && (
        <div className="space-y-3">
          <p>
            Total <strong className="tabular-nums">{formatBRL(sale.totalCents)}</strong>
          </p>
          {fiscal && (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm">
              A NFC-e também será cancelada na SEFAZ. Isso só é aceito até <strong>30 minutos</strong> depois da emissão.
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Motivo</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={255}
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
            <span className={`mt-1 block text-xs ${ok ? "text-muted" : "text-danger"}`}>
              {reason.trim().length}/{min} caracteres no mínimo
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}
