"use client";

import { useEffect, useMemo, useState } from "react";
import type { Expense } from "@/types";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DespesasTable() {
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/expenses?month=${month}&year=${year}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar despesas");
        }
        if (!cancelled) {
          // Normaliza _id -> id para compatibilidade com os tipos front-end
          const normalized = (json.data || []).map((d: any) => ({ ...d, id: d._id?.toString() ?? d.id }));
          setItems(normalized);
        }
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
    const total = items.reduce((s, c) => s + (c.amount ?? 0), 0);
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

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Carregando...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Nenhuma despesa encontrada.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
                  <td className="px-4 py-3">
                    {new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-medium">{item.category}</td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatBRL(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
