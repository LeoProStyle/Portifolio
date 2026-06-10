"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type DashboardPayload = {
  totalEntrada: number;
  totalDespesas: number;
  lucroEstimado: number;
  totalsByPayment: {
    dinheiro: number;
    pix: number;
    cartao_credito: number;
    cartao_debito: number;
  };
  closures?: Array<{ date: string; total: number }>;
};

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);
  const month = String(now.getMonth() + 1);
  const year = String(now.getFullYear());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // Usa o endpoint /api/dashboard para consolidação
        const res = await fetch(`/api/dashboard?month=${month}&year=${year}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar dashboard");
        }

        if (!cancelled) {
          setPayload(json?.payload ?? null);
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

  const faturamentoMes = payload?.totalEntrada ?? 0;
  const despesasMes = payload?.totalDespesas ?? 0;
  const totalPix = payload?.totalsByPayment?.pix ?? 0;
  const lucroEstimado = payload?.lucroEstimado ?? 0;

  // "Hoje": MVP simplificado baseado no mesmo endpoint (a lista diária do payload existe)
  const totalHoje = useMemo(() => {
    const d = payload?.closures?.find?.((c: any) => c?.date === now.toISOString().slice(0, 10));
    return typeof d?.total === "number" ? d.total : 0;
  }, [payload, now]);

  return (
    <div className="space-y-6 pb-20 lg:pb-0 p-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">MVP com dados reais (Mongo via API).</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Faturamento Hoje</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "—" : formatBRL(totalHoje)}</div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Faturamento Mês</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "—" : formatBRL(faturamentoMes)}</div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Total Pix</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "—" : formatBRL(totalPix)}</div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Lucro Estimado</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "—" : formatBRL(lucroEstimado)}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="font-semibold">Próximo passo</div>
        <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">
          Gerar gráficos com Recharts (receita diária/semanal/mensal, formas de pagamento e fechamento diário).
        </div>
      </div>
      {payload && <DashboardCharts payload={payload} />}
    </div>
  );
}



