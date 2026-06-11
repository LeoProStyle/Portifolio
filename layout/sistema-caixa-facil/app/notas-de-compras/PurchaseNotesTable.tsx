"use client";

import { useEffect, useMemo, useState } from "react";
import type { Expense } from "@/types";
import Swal from "sweetalert2";
import { useExportSelection } from "@/lib/useExportSelection";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PurchaseNotesTable() {
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [items, setItems] = useState<Expense[]>([]);
  const sel = useExportSelection("notas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (year) params.set("year", year);
        if (categoryFilter) params.set("category", categoryFilter);
        if (supplierFilter) params.set("supplier", supplierFilter);
        if (startDate) params.set("start", startDate);
        if (endDate) params.set("end", endDate);
        const res = await fetch(`/api/purchase-notes?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar notas de compras");
        if (!cancelled) {
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
  }, [month, year, categoryFilter, supplierFilter, startDate, endDate]);

  const totals = useMemo(() => {
    const total = items.reduce((s, c) => s + (c.amount ?? 0), 0);
    return { total };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Mês</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
          <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
          <label className="text-sm font-medium">Categoria</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <option value="">Todos</option>
            <option>Mercadoria</option>
            <option>Bebidas</option>
            <option>Embalagens</option>
            <option>Gás</option>
            <option>Energia</option>
            <option>Água</option>
            <option>Internet</option>
            <option>Aluguel</option>
            <option>Marketing</option>
            <option>Limpeza</option>
            <option>Manutenção</option>
            <option>Impostos</option>
            <option>Outros</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fornecedor</label>
          <input value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} placeholder="Fornecedor" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Início</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fim</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Total do período</label>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-950">{formatBRL(totals.total)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium"> </th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Fornecedor</th>
              <th className="px-4 py-3 font-medium">Forma de Pagamento</th>
              <th className="px-4 py-3 font-medium">Documento Fiscal</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">Carregando...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-red-600">{error}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">Nenhuma nota de compra encontrada.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
                  <td className="px-4 py-3"><input type="checkbox" checked={sel.selected.includes(item.id)} onChange={(e) => sel.toggle(item.id, e.target.checked)} /></td>
                  <td className="px-4 py-3">{new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-medium">{item.category}</td>
                  <td className="px-4 py-3">{item.supplier}</td>
                  <td className="px-4 py-3">{item.paymentMethod}</td>
                  <td className="px-4 py-3">{item.hasFiscalDocument ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatBRL(item.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => alert(JSON.stringify(item, null, 2))} className="text-sm text-zinc-600">Visualizar</button>
                      <a href={`/notas-de-compras/novo?edit=${item.id}`} className="text-sm text-blue-600">Editar</a>
                      <button onClick={async () => {
                        const r = await Swal.fire({ title: 'Confirma excluir esta nota?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar' });
                        if (!r.isConfirmed) return;
                        Swal.fire({ title: 'Excluindo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        try {
                          const res = await fetch('/api/purchase-notes', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
                          const json = await res.json();
                          if (!res.ok || !json?.ok) throw new Error(json?.error || 'Erro ao excluir');
                          Swal.close();
                          Swal.fire({ icon: 'success', title: 'Excluída' });
                          setItems((s) => s.filter((x) => x.id !== item.id));
                        } catch (err) {
                          Swal.close();
                          const message = err instanceof Error ? err.message : 'Erro inesperado';
                          Swal.fire({ icon: 'error', title: 'Erro', text: message });
                        }
                      }} className="text-sm text-red-600">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
