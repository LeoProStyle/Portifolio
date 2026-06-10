"use client";

import Link from "next/link";
import DespesasTable from "./DespesasTable";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function DespesasPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
            MVP: lista real via Mongo (GET /api/expenses).
          </p>
        </div>
        <Link
          href="/despesas/novo"
          className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm font-medium dark:bg-white dark:text-black"
        >
          Nova despesa
        </Link>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <DespesasTable />
      </div>
      </div>
    </ProtectedRoute>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

