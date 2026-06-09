import ClosureForm from "./ClosureForm";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NovoFechamentoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Novo fechamento</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Registre o fechamento diário por forma de pagamento (MVP).
      </p>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <ClosureForm defaultDate={todayISODate()} />
      </div>
    </div>
  );
}


