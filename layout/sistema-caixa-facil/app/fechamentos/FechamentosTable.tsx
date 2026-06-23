"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { CashClosure } from "@/types";
import { useExportSelection } from "@/lib/useExportSelection";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FechamentosTable() {
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const [items, setItems] = useState<CashClosure[]>([]);
  const sel = useExportSelection("fechamentos");
  const headerRef = useRef<HTMLInputElement | null>(null);
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
        if (!cancelled) {
          const data = (json.data || []).map((d: any) => ({
            ...d,
            id: String(d.id ?? d._id),
            pix: Number(d.pix ?? 0),
            cartao_credito: Number(d.cartao_credito ?? 0),
            cartao_debito: Number(d.cartao_debito ?? 0),
            maquininha: Number(d.maquininha ?? 0),
            total: Number(d.total ?? 0),
          }));
          setItems(data);
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

  useEffect(() => {
    if (!headerRef.current) return;
    headerRef.current.indeterminate = sel.selected.length > 0 && sel.selected.length < items.length;
  }, [sel.selected, items.length]);



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

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={items.length === 0}
          onClick={async () => {
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({ title: 'Preparando exportação...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
              const body: any = { month, year, kind: 'Excel', types: ['fechamentos'] };
              if (sel.selected.length > 0) body.selected = { fechamentos: sel.selected };
              const res = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
              if (!res.ok) throw new Error('Erro ao exportar');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `caixa-facil-fechamentos-${year}-${String(month).padStart(2,'0')}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              Swal.close();
              Swal.fire({ icon: 'success', title: 'Exportado', text: 'Planilha baixada.' });
            } catch (err) {
              Swal.close();
              const message = err instanceof Error ? err.message : 'Erro inesperado';
              (await import('sweetalert2')).default.fire({ icon: 'error', title: 'Erro', text: message });
            }
          }}
          className="rounded-xl bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60 mb-2"
        >
          Exportar Excel
        </button>
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
                <th className="py-2">
                  <input
                    ref={headerRef}
                    type="checkbox"
                    checked={items.length > 0 && sel.selected.length === items.length}
                    onChange={(e) => {
                      if (e.target.checked) sel.setSelected(items.map((i) => i.id));
                      else sel.clear();
                    }}
                  />
                </th>
                <th className="py-2">Data</th>
                <th className="py-2">Pix</th>
                <th className="py-2">Crédito</th>
                <th className="py-2">Débito</th>
                <th className="py-2">Maquininha</th>
                <th className="py-2">Total</th>
                <th className="py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                    <td colSpan={8} className="py-4 text-zinc-600 dark:text-zinc-300">
                  Carregando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                    <td colSpan={8} className="py-4 text-zinc-600 dark:text-zinc-300">
                  Sem fechamentos para este período.
                </td>
              </tr>
            ) : (
              items.map((r, idx) => (
                    <tr key={r.id ?? `${r.date}-${idx}`} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-3"><input type="checkbox" checked={sel.selected.includes(r.id)} onChange={(e) => sel.toggle(r.id, e.target.checked)} /></td>
                      <td className="py-3">{r.date.split("-").reverse().join("/")}</td>
                      <td className="py-3">{formatBRL(r.pix ?? 0)}</td>
                      <td className="py-3">{formatBRL(r.cartao_credito ?? 0)}</td>
                      <td className="py-3">{formatBRL(r.cartao_debito ?? 0)}</td>
                      <td className="py-3">{formatBRL((r as any).maquininha ?? 0)}</td>
                      <td className="py-3 font-semibold">{formatBRL(r.total ?? 0)}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => alert(JSON.stringify(r, null, 2))} className="text-sm text-zinc-600">Visualizar</button>
                          <a href={`/fechamentos/novo?edit=${encodeURIComponent(r.id ?? '')}`} className="text-sm text-blue-600">Editar</a>
                          <button onClick={async () => {
                            const Swal = (await import('sweetalert2')).default;
                            const res = await Swal.fire({ title: 'Confirma excluir este fechamento?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar' });
                            if (!res.isConfirmed) return;
                            Swal.fire({ title: 'Excluindo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                            try {
                              const del = await fetch('/api/closures', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                              const json = await del.json();
                              if (!del.ok || !json?.ok) throw new Error(json?.error || 'Erro ao excluir');
                              Swal.close();
                              Swal.fire({ icon: 'success', title: 'Excluído' });
                              setItems((s) => s.filter((x) => (x.id) !== (r.id)));
                            } catch (err) {
                              Swal.close();
                              const message = err instanceof Error ? err.message : 'Erro inesperado';
                              (await import('sweetalert2')).default.fire({ icon: 'error', title: 'Erro', text: message });
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

