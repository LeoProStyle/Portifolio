"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Props = {
  payload: any;
};

const COLORS = ["#10b981", "#06b6d4", "#6366f1", "#f97316"];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardCharts({ payload }: Props) {
  const dailyData = useMemo(() => {
    const closures = payload?.closures ?? [];
    return closures.map((c: any) => ({
      date: c.date.slice(8, 10),
      total: Number(c.total ?? 0),
    }));
  }, [payload]);

  const paymentData = useMemo(() => {
    const t = payload?.totalsByPayment ?? {};
    return [
      { name: "Dinheiro", value: Number(t.dinheiro ?? 0) },
      { name: "PIX", value: Number(t.pix ?? 0) },
      { name: "Cartão Crédito", value: Number(t.cartao_credito ?? 0) },
      { name: "Cartão Débito", value: Number(t.cartao_debito ?? 0) },
    ];
  }, [payload]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-2 rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Receita diária (mês)</div>
        <div style={{ width: "100%", height: 240, overflow: "visible" }}>
          <ResponsiveContainer>
            <LineChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => v} />
              <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Distribuição por forma de pagamento</div>
        <div style={{ width: "100%", height: 240, overflow: "visible" }}>
          <ResponsiveContainer>
            <PieChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <Legend verticalAlign="top" height={24} />
              <Pie
                data={paymentData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={70}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {paymentData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function renderCustomizedLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, index, value, name } = props;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24; // offset labels away from pie
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? "start" : "end";

  return (
    <text x={x} y={y} fill="#06b6d4" textAnchor={anchor} dominantBaseline="central" style={{ fontSize: 12 }}>
      {`${name}: ${formatBRL(Number(value))}`}
    </text>
  );
}
