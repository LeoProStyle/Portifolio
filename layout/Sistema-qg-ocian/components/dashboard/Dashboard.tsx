"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Lock, MessageSquareText, TrendingDown, TrendingUp } from "lucide-react";
import { NameTooltip } from "@/components/NameTooltip";
import { api } from "@/lib/client";
import { addDays, formatWeekdayShort, todayKey } from "@/lib/date";
import { formatBRL } from "@/lib/money";
import type { StatsDay, StatsResponse } from "@/lib/types";
import { RevenueChart } from "./RevenueChart";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export function Dashboard() {
  const [period, setPeriod] = useState(7);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankBy, setRankBy] = useState<"qty" | "value">("qty");

  const load = useCallback(async (days: number) => {
    setError(null);
    const to = todayKey();
    try {
      setStats(await api<StatsResponse>(`/api/stats?from=${addDays(to, -(days - 1))}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  const ranking = stats
    ? [...stats.products].sort((a, b) => (rankBy === "qty" ? b.qty - a.qty : b.totalCents - a.totalCents)).slice(0, 10)
    : [];
  const rankMax = ranking.length ? Math.max(...ranking.map((p) => (rankBy === "qty" ? p.qty : p.totalCents))) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">Desempenho da Saída de produtos</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Dashboard</h1>
        </div>
        <div className="flex gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              aria-pressed={period === p.days}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                period === p.days ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">{error}</p>}
      {!stats && !error && <DashSkeleton />}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do período">
            <Kpi
              label="Total que saiu"
              value={formatBRL(stats.totals.totalCents)}
              current={stats.totals.totalCents}
              previous={stats.previous.totalCents}
            />
            <Kpi
              label="Itens"
              value={String(stats.totals.totalItems)}
              current={stats.totals.totalItems}
              previous={stats.previous.totalItems}
            />
            <Kpi label="Média por dia" value={formatBRL(stats.totals.avgPerDayCents)} hint="dias com saída" />
            <Kpi label="Dias com saída" value={`${stats.totals.activeDays} de ${stats.days.length}`} />
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="font-bold">Valor que saiu por dia</h2>
            <p className="mb-4 text-sm text-muted">Passe o dedo ou o mouse nas barras para ver os detalhes.</p>
            <RevenueChart days={stats.days} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <section className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-bold">Mais saem</h2>
                <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="group" aria-label="Ordenar por">
                  {(
                    [
                      ["qty", "Quantidade"],
                      ["value", "Valor"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setRankBy(k)}
                      aria-pressed={rankBy === k}
                      className={`rounded-lg px-2.5 py-1 font-semibold ${rankBy === k ? "bg-surface shadow-sm" : "text-muted"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {ranking.length === 0 ? (
                <p className="py-8 text-center text-muted">Sem saídas no período.</p>
              ) : (
                <ol className="space-y-3">
                  {ranking.map((p, idx) => {
                    const v = rankBy === "qty" ? p.qty : p.totalCents;
                    return (
                      <li key={p.productId} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-bold text-muted tabular-nums">{idx + 1}</span>
                        <NameTooltip text={p.name} className="min-w-0">
                          <span
                            data-clamp
                            tabIndex={0}
                            className="block truncate rounded font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            {p.emoji && <span aria-hidden>{p.emoji} </span>}
                            {p.name}
                          </span>
                        </NameTooltip>
                        <span className="text-right text-sm tabular-nums">
                          <strong>{p.qty}</strong> <span className="text-muted">· {formatBRL(p.totalCents)}</span>
                        </span>
                        <span />
                        <span className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span
                            className="block h-full rounded-full bg-chart"
                            style={{ width: `${Math.max(3, (v / rankMax) * 100)}%` }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="mb-4 font-bold">Por categoria</h2>
              {stats.categories.length === 0 ? (
                <p className="py-8 text-center text-muted">Sem saídas no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="pb-2 font-bold">Categoria</th>
                      <th className="pb-2 text-right font-bold">Itens</th>
                      <th className="pb-2 text-right font-bold">Valor</th>
                      <th className="pb-2 text-right font-bold">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {stats.categories.map((c) => (
                      <tr key={c.category}>
                        <td className="py-2 font-semibold">{c.category}</td>
                        <td className="py-2 text-right tabular-nums">{c.qty}</td>
                        <td className="py-2 text-right tabular-nums">{formatBRL(c.totalCents)}</td>
                        <td className="py-2 text-right text-muted tabular-nums">
                          {stats.totals.totalCents ? Math.round((c.totalCents / stats.totals.totalCents) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="mb-1 font-bold">Histórico de dias</h2>
            <p className="mb-3 text-sm text-muted">Toque em um dia para ver a relação completa.</p>
            <ul className="divide-y divide-line">
              {[...stats.days].reverse().map((d) => (
                <DayRow key={d.date} day={d} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  current,
  previous,
  hint,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
}) {
  let delta: number | null = null;
  if (current !== undefined && previous) delta = Math.round(((current - previous) / previous) * 100);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      {delta !== null ? (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
          {delta >= 0 ? "+" : ""}
          {delta}% <span className="font-medium text-muted">vs. período anterior</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">{hint ?? (previous === 0 ? "sem período anterior" : " ")}</p>
      )}
    </div>
  );
}

function DayRow({ day }: { day: StatsDay }) {
  const [open, setOpen] = useState(false);
  const hasItems = day.items.length > 0;
  return (
    <li>
      <button
        onClick={() => hasItems && setOpen(!open)}
        disabled={!hasItems}
        aria-expanded={hasItems ? open : undefined}
        className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
      >
        <span className="w-24 shrink-0 font-semibold capitalize">{formatWeekdayShort(day.date)}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted">
          {day.status === "closed" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold">
              <Lock size={11} aria-hidden /> fechado
            </span>
          )}
          {day.status === "open" && (
            <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-semibold text-success">aberto</span>
          )}
          {day.notes && <MessageSquareText size={14} aria-label="Tem observação" />}
          {hasItems ? `${day.totalItems} itens` : "sem saída"}
        </span>
        <span className="font-bold tabular-nums">{hasItems ? formatBRL(day.totalCents) : "—"}</span>
        {hasItems && (
          <ChevronDown size={18} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        )}
      </button>
      {open && (
        <div className="mb-3 space-y-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <ul className="divide-y divide-line">
            {day.items.map((i) => (
              <li key={i.productId} className="flex gap-2 py-1.5">
                <span className="w-8 font-bold text-brand tabular-nums">{i.qty}×</span>
                <span className="flex-1">{i.name}</span>
                <span className="tabular-nums">{formatBRL(i.qty * i.priceCents)}</span>
              </li>
            ))}
          </ul>
          {day.notes && <p className="whitespace-pre-wrap border-t border-line pt-2 text-muted">📝 {day.notes}</p>}
        </div>
      )}
    </li>
  );
}

function DashSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-72 rounded-3xl bg-surface-2" />
    </div>
  );
}
