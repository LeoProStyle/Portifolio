import { CheckCircle2, MessageSquareText } from "lucide-react";
import { formatBRL } from "@/lib/money";
import type { RegisterDTO } from "@/lib/types";

/** Relação de um dia fechado: o que saiu, total e observação. */
export function DayReport({ register }: { register: RegisterDTO }) {
  const byCategory = new Map<string, typeof register.items>();
  for (const i of register.items) byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line bg-success-soft px-5 py-4 text-success">
        <CheckCircle2 aria-hidden />
        <p className="font-bold">Dia fechado — relação salva</p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-surface px-5 py-4">
          <p className="text-sm text-muted">Total que saiu</p>
          <p className="text-3xl font-extrabold tabular-nums">{formatBRL(register.totalCents)}</p>
        </div>
        <div className="bg-surface px-5 py-4">
          <p className="text-sm text-muted">Itens</p>
          <p className="text-3xl font-extrabold tabular-nums">{register.totalItems}</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {register.items.length === 0 && <p className="text-muted">Nenhuma saída anotada neste dia.</p>}
        {[...byCategory.entries()].map(([cat, items]) => (
          <div key={cat}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{cat}</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {items.map((i) => (
                  <tr key={i.productId}>
                    <td className="py-2 pr-2 font-bold tabular-nums text-brand">{i.qty}×</td>
                    <td className="w-full py-2">
                      {i.emoji && <span aria-hidden>{i.emoji} </span>}
                      {i.name}
                      <span className="ml-1 text-muted">({formatBRL(i.priceCents)})</span>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatBRL(i.qty * i.priceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {register.notes && (
          <div className="flex gap-3 rounded-2xl bg-surface-2 p-4">
            <MessageSquareText size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <p className="whitespace-pre-wrap text-sm">{register.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
