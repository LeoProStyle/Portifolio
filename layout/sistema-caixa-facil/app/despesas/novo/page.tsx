import ExpenseForm from "./ExpenseForm";
import ProtectedRoute from "@/components/ProtectedRoute";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function NovaDespesaPage({ searchParams }: { searchParams?: any }) {
  const sp = searchParams && typeof (searchParams as any)?.then === "function" ? await searchParams : searchParams;
  const rawEdit = sp?.edit;
  const expenseId = Array.isArray(rawEdit) ? rawEdit[0] : (rawEdit as string | undefined) || undefined;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{expenseId ? "Editar despesa" : "Nova despesa"}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {expenseId ? "Edite a despesa selecionada." : "Registre uma despesa do mês (MVP)."}
        </p>

        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <ExpenseForm defaultDate={todayISODate()} expenseId={expenseId} />
        </div>
      </div>
    </ProtectedRoute>
  );
}


