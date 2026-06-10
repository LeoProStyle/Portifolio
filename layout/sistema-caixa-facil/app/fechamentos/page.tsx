"use client";

import Link from "next/link";
import FechamentosTable from "./FechamentosTable";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function FechamentosPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-4 pb-20 lg:pb-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fechamentos diários</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
              MVP: lista real via Mongo (GET /api/closures).
            </p>
          </div>
          <Link
            href="/fechamentos/novo"
            className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm font-medium dark:bg-white dark:text-black"
          >
            Novo fechamento
          </Link>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <FechamentosTable />
        </div>
      </div>
    </ProtectedRoute>
  );
}


