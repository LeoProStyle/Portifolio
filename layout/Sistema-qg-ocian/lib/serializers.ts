import type { ProductRecord } from "@/models/Product";
import type { DailyRegisterRecord, RegisterItemRecord } from "@/models/DailyRegister";
import type { ProductDTO, RegisterDTO, RegisterItemDTO } from "./types";

export function toProductDTO(p: ProductRecord): ProductDTO {
  return {
    id: String(p._id),
    name: p.name,
    category: p.category,
    priceCents: p.priceCents,
    emoji: p.emoji ?? "",
    active: p.active,
    sortOrder: p.sortOrder ?? 0,
  };
}

export function toItemDTO(i: RegisterItemRecord): RegisterItemDTO {
  return {
    productId: String(i.productId),
    name: i.name,
    category: i.category,
    emoji: i.emoji ?? "",
    priceCents: i.priceCents,
    qty: i.qty,
  };
}

export function computeTotals(items: { priceCents: number; qty: number }[]) {
  return items.reduce(
    (acc, i) => ({ totalCents: acc.totalCents + i.priceCents * i.qty, totalItems: acc.totalItems + i.qty }),
    { totalCents: 0, totalItems: 0 },
  );
}

/** Para dias abertos, os totais são calculados na hora a partir dos itens. */
export function toRegisterDTO(r: DailyRegisterRecord): RegisterDTO {
  const items = r.items.map(toItemDTO).filter((i) => i.qty > 0);
  const totals = r.status === "closed" ? { totalCents: r.totalCents, totalItems: r.totalItems } : computeTotals(items);
  return {
    date: r.date,
    status: r.status,
    items,
    ...totals,
    notes: r.notes ?? "",
    closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : null,
  };
}

export function emptyRegister(date: string): RegisterDTO {
  return { date, status: "open", items: [], totalCents: 0, totalItems: 0, notes: "", closedAt: null };
}
