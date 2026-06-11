"use client";

import PurchaseNoteForm from "./PurchaseNoteForm";
import ProtectedRoute from "@/components/ProtectedRoute";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NovaNotaCompraPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nova nota de compra</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Registre uma nota de compra (mesma forma que Despesas).</p>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <PurchaseNoteForm defaultDate={todayISODate()} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
