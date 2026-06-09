import ExportActions from "./ExportActions";

export default function RelatoriosPage() {
  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportação mensal</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
          MVP: consolida mês/ano no backend e mostra preview. PDF/Excel/XML real em seguida.
        </p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mês</label>
            <select className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" disabled>
              <option>Definido em ExportActions</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ano</label>
            <select className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" disabled>
              <option>Definido em ExportActions</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ações</label>
            <ExportActions />
          </div>
        </div>

        <div className="mt-5 text-sm text-zinc-600 dark:text-zinc-300">
          Usa o endpoint <code>/api/export</code> para consolidar fechamentos e despesas do mês.
        </div>
      </div>
    </div>
  );
}



