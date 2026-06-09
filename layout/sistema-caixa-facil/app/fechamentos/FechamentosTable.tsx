"use client";

import { useEffect, useMemo, useState } from "react";
import type { CashClosure } from "@/types";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FechamentosTable() {
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const [items, setItems] = useState<CashClosure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;


    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/closures?month=${month}&year=${year}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar fechamentos");
        }
        if (!cancelled) setItems(json.data || []);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Erro inesperado";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [month, year]);



  const totals = useMemo(() => {
    const total = items.reduce((s, c) => s + (c.total ?? 0), 0);
    return { total };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Mês</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const m = String(i + 1);
              return (
                <option key={m} value={m}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Ano</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {Array.from({ length: 3 }).map((_, i) => {
              const y = String(new Date().getFullYear() - 1 + i);
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Total do período</label>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-950">
            {formatBRL(totals.total)}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2">Data</th>
              <th className="py-2">Dinheiro</th>
              <th className="py-2">Pix</th>
              <th className="py-2">Crédito</th>
              <th className="py-2">Débito</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-600 dark:text-zinc-300">
                  Carregando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-600 dark:text-zinc-300">
                  Sem fechamentos para este período.
                </td>
              </tr>
            ) : (
              items.map((r, idx) => (
                <tr key={r.id ?? `${r.date}-${idx}`} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3">{r.date.split("-").reverse().join("/")}</td>
                  <td className="py-3">{formatBRL(r.dinheiro ?? 0)}</td>
                  <td className="py-3">{formatBRL(r.pix ?? 0)}</td>
                  <td className="py-3">{formatBRL(r.cartao_credito ?? 0)}</td>
                  <td className="py-3">{formatBRL(r.cartao_debito ?? 0)}</td>
                  <td className="py-3 font-semibold">{formatBRL(r.total ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

