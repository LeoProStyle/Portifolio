"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Settings } from "lucide-react";
import { api } from "@/lib/client";
import type { VendasCatalogResponse } from "@/lib/types";
import { Caixa } from "./Caixa";
import { SalesDay } from "./SalesDay";

type Tab = "caixa" | "dia";

/** Aba Vendas: Caixa (montar e finalizar pedido) e Vendas do dia (reimprimir, cancelar). */
export function VendasApp() {
  const [tab, setTab] = useState<Tab>("caixa");
  const [catalog, setCatalog] = useState<VendasCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCatalog(await api<VendasCatalogResponse>("/api/vendas/catalog"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto text-danger" aria-hidden />
        <p className="mt-2 font-semibold">{error}</p>
        <button onClick={load} className="mt-4 rounded-xl bg-ink px-4 py-2 font-semibold text-bg">
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vendas" className="flex gap-1 rounded-2xl border border-line bg-surface p-1">
          {(
            [
              ["caixa", "Caixa"],
              ["dia", "Vendas do dia"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {catalog?.role === "admin" && (
          <Link
            href="/vendas/config"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
          >
            <Settings size={16} aria-hidden /> Configuração fiscal
          </Link>
        )}
      </div>

      {tab === "caixa" ? (
        catalog ? (
          <Caixa catalog={catalog} onReload={load} />
        ) : (
          <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
            <div className="h-12 rounded-2xl bg-surface-2" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-surface-2" />
              ))}
            </div>
          </div>
        )
      ) : (
        <SalesDay role={catalog?.role ?? "staff"} />
      )}
    </div>
  );
}
