"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate, formatWeekdayShort } from "@/lib/date";
import { formatBRL } from "@/lib/money";
import type { StatsDay } from "@/lib/types";

type Point = { date: string; label: string; value: number; items: number };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold capitalize">{formatWeekdayShort(p.date)}</p>
      <p className="font-bold tabular-nums">{formatBRL(p.value)}</p>
      <p className="text-muted">{p.items} itens</p>
    </div>
  );
}

/** Barras de uma única série (valor por dia). Título nomeia a série, então não há legenda. */
export function RevenueChart({ days }: { days: StatsDay[] }) {
  const data: Point[] = days.map((d) => ({
    date: d.date,
    label: formatShortDate(d.date),
    value: d.totalCents,
    items: d.totalItems,
  }));
  const dense = data.length > 14;

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={dense ? 2 : "20%"}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            interval={dense ? "preserveStartEnd" : 0}
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={(v: number) => formatBRL(v).replace(",00", "")}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" name="Valor" fill="var(--chart)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
