"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "@/components/Toaster";
import { download } from "@/lib/client";
import { addMonths, currentMonthKey, formatMonth } from "@/lib/date";

export const inputClass =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{subtitle}</p>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
    </div>
  );
}

/** ‹ novembro de 2026 › — não deixa avançar para meses futuros. */
export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const current = currentMonthKey();
  const label = formatMonth(month);
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="Mês">
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Mês anterior"
        className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <label className="relative min-w-40 flex-1 text-center">
        <span className="sr-only">Escolher mês</span>
        <span aria-hidden className="pointer-events-none block px-2 font-bold first-letter:uppercase">
          {label}
        </span>
        <input
          type="month"
          value={month}
          max={current}
          onChange={(e) => e.target.value && onChange(e.target.value > current ? current : e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={month >= current}
        aria-label="Próximo mês"
        className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

export function ExportButton({ url, label }: { url: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await download(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível exportar.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
    >
      <Download size={16} aria-hidden /> {busy ? "Gerando…" : label}
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "brand" | "danger" | "success";
}) {
  const color = { default: "", brand: "text-brand", danger: "text-danger", success: "text-success" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}

export function ConfirmFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  busy,
  danger,
  formId,
}: {
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  formId?: string;
}) {
  return (
    <>
      <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-line py-3 font-semibold hover:bg-surface-2">
        Cancelar
      </button>
      <button
        type={formId ? "submit" : "button"}
        form={formId}
        onClick={onConfirm}
        disabled={busy}
        data-autofocus={danger ? true : undefined}
        className={`flex-[2] rounded-2xl py-3 font-bold disabled:opacity-60 ${danger ? "bg-danger text-white" : "bg-brand text-brand-ink"}`}
      >
        {busy ? "Salvando…" : confirmLabel}
      </button>
    </>
  );
}

/** Lê "2,5" / "2.5" / "3" como número (quantidade); null se inválido. */
export function parseQty(input: string): number | null {
  const v = input.trim().replace(/\./g, input.includes(",") ? "" : ".").replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(v)) return null;
  return Number(v);
}
