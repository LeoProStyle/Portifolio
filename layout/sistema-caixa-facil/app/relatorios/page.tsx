"use client";

import ExportActions from "./ExportActions";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function RelatoriosPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-4 pb-20 lg:pb-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exportação mensal</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
            Selecione o mês e ano, depois escolha o formato de exportação (PDF, Excel ou XML).
          </p>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <ExportActions />

          <div className="mt-5 text-sm text-zinc-600 dark:text-zinc-300">
            Consolidação em tempo real via endpoint <code>/api/export</code>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}



