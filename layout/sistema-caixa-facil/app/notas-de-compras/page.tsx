"use client";

import Link from "next/link";
import PurchaseNotesTable from "./PurchaseNotesTable";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function NotasDeComprasPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-4 pb-20 lg:pb-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notas de Compras</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">Mesmo comportamento de Despesas (mesma lista/CRUD).</p>
          </div>
          <Link
            href="/notas-de-compras/novo"
            className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm font-medium dark:bg-white dark:text-black"
          >
            Nova nota de compra
          </Link>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <PurchaseNotesTable />
        </div>
      </div>
    </ProtectedRoute>
  );
}
