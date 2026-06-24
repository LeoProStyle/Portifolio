"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClosureForm from "./ClosureForm";

export default function ClientEditor({ defaultDate }: { defaultDate: string }) {
  const sp = useSearchParams();
  const rawEdit = sp?.get("edit");
  const editId = rawEdit || undefined;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{editId ? 'Editar fechamento' : 'Novo fechamento'}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Registre o fechamento diário por forma de pagamento (MVP).</p>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <ClosureForm defaultDate={defaultDate} closureId={editId} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
