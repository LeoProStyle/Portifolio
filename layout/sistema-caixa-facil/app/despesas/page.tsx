import Link from "next/link";

export default function DespesasPage() {
  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
            MVP: foco no mês (mock por enquanto).
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
        <div className="text-sm font-medium">Exemplo (mock)</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2">Data</th>
                <th className="py-2">Categoria</th>
                <th className="py-2">Descrição</th>
                <th className="py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {[
                { date: "01/06/2026", cat: "Internet", desc: "Plano mensal", amount: 120 },
                { date: "15/06/2026", cat: "Funcionários", desc: "Ajuda custo", amount: 200 },
              ].map((r) => (
                <tr key={r.date + r.desc} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3">{r.date}</td>
                  <td className="py-3">{r.cat}</td>
                  <td className="py-3">{r.desc}</td>
                  <td className="py-3 font-semibold">{formatBRL(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

