import { connectDB } from "./db";
import { addDays, dateRange } from "./date";
import { toRegisterDTO } from "./serializers";
import type { RegisterDTO, StatsDay, StatsProduct, StatsResponse } from "./types";
import { DailyRegister, type DailyRegisterRecord } from "@/models/DailyRegister";

/** Monta os números do dashboard a partir dos registros de saída (função pura, testável). */
export function buildStats(from: string, to: string, registers: RegisterDTO[], previous: RegisterDTO[]): StatsResponse {
  const byDate = new Map(registers.map((r) => [r.date, r]));

  const days: StatsDay[] = dateRange(from, to).map((date) => {
    const r = byDate.get(date);
    if (!r || r.items.length === 0) {
      return { date, status: r?.status === "closed" ? "closed" : "empty", totalCents: 0, totalItems: 0, notes: r?.notes ?? "", items: [] };
    }
    return { date, status: r.status, totalCents: r.totalCents, totalItems: r.totalItems, notes: r.notes, items: r.items };
  });

  const products = new Map<string, StatsProduct>();
  const categories = new Map<string, { category: string; qty: number; totalCents: number }>();
  for (const r of registers) {
    for (const i of r.items) {
      const p = products.get(i.productId) ?? {
        productId: i.productId,
        name: i.name,
        emoji: i.emoji,
        category: i.category,
        qty: 0,
        totalCents: 0,
      };
      p.qty += i.qty;
      p.totalCents += i.qty * i.priceCents;
      products.set(i.productId, p);

      const c = categories.get(i.category) ?? { category: i.category, qty: 0, totalCents: 0 };
      c.qty += i.qty;
      c.totalCents += i.qty * i.priceCents;
      categories.set(i.category, c);
    }
  }

  const totalCents = days.reduce((s, d) => s + d.totalCents, 0);
  const totalItems = days.reduce((s, d) => s + d.totalItems, 0);
  const activeDays = days.filter((d) => d.totalItems > 0).length;

  return {
    from,
    to,
    totals: { totalCents, totalItems, activeDays, avgPerDayCents: activeDays ? Math.round(totalCents / activeDays) : 0 },
    previous: {
      totalCents: previous.reduce((s, r) => s + r.totalCents, 0),
      totalItems: previous.reduce((s, r) => s + r.totalItems, 0),
    },
    days,
    products: [...products.values()].sort((a, b) => b.qty - a.qty || b.totalCents - a.totalCents),
    categories: [...categories.values()].sort((a, b) => b.totalCents - a.totalCents),
  };
}

export async function getStats(from: string, to: string): Promise<StatsResponse> {
  await connectDB();
  const span = dateRange(from, to).length;
  const prevFrom = addDays(from, -span);
  const prevTo = addDays(from, -1);

  const docs = await DailyRegister.find({ date: { $gte: prevFrom, $lte: to } })
    .sort({ date: 1 })
    .lean<DailyRegisterRecord[]>();
  const all = docs.map(toRegisterDTO);
  return buildStats(
    from,
    to,
    all.filter((r) => r.date >= from),
    all.filter((r) => r.date >= prevFrom && r.date <= prevTo),
  );
}
