"use client";

import { useState } from "react";
import Swal from "sweetalert2";

type ExportKind = "PDF" | "Excel" | "XML";

export default function ExportActions() {
  const [loading, setLoading] = useState<ExportKind | null>(null);

  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const onExport = async (kind: ExportKind) => {
    setLoading(kind);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, year, kind }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || `Falha ao gerar ${kind}`);
      }

      // Para PDF e Excel, retorna binary
      if (kind === "PDF" || kind === "Excel") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `caixa-facil-${year}-${month}.${kind === "PDF" ? "pdf" : "xlsx"}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        Swal.fire({
          icon: "success",
          title: "Sucesso!",
          text: `${kind} gerado e baixado com sucesso.`,
          timer: 2000,
        });
        return;
      }

      // Para XML, retorna text
      if (kind === "XML") {
        const xml = await res.text();
        const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `caixa-facil-${year}-${month}.xml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        Swal.fire({
          icon: "success",
          title: "Sucesso!",
          text: "XML gerado e baixado com sucesso.",
          timer: 2000,
        });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      Swal.fire({
        icon: "error",
        title: "Erro!",
        text: message,
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Mês</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const m = String(i + 1).padStart(2, "0");
              return (
                <option key={m} value={m}>
                  {m}
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
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => onExport("PDF")}
          className="flex-1 rounded-xl bg-zinc-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {loading === "PDF" ? "Gerando..." : "📄 PDF"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => onExport("Excel")}
          className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading === "Excel" ? "Gerando..." : "📊 Excel"}
        </button>
      </div>

      <button
        type="button"
        disabled={!!loading}
        onClick={() => onExport("XML")}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {loading === "XML" ? "Gerando..." : "📋 XML"}
      </button>
    </div>
  );
}


