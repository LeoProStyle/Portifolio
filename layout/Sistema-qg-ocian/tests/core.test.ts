import { describe, expect, it } from "vitest";
import { addDays, dateRange, isDateKey, todayKey } from "@/lib/date";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { computeTotals } from "@/lib/serializers";
import { buildStats } from "@/lib/stats";
import { isAdminPath, safeNextPath } from "@/lib/auth";
import type { RegisterDTO } from "@/lib/types";

describe("money", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(1250).replace(/\s/g, " ")).toBe("R$ 12,50");
  });
  it.each([
    ["12,50", 1250],
    ["12.5", 1250],
    ["R$ 1.234,56", 123456],
    ["7", 700],
    ["1.000", 100000],
    ["0,05", 5],
  ])("lê %s como %i centavos", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });
  it.each(["", "abc", "12,345", "-3"])("rejeita %s", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
  it("centsToInput", () => expect(centsToInput(350)).toBe("3,50"));
});

describe("date", () => {
  it("usa o fuso de São Paulo (22h no Brasil ainda é o mesmo dia)", () => {
    // 2026-11-14 01:00 UTC == 2026-11-13 22:00 em São Paulo
    expect(todayKey(new Date("2026-11-14T01:00:00Z"))).toBe("2026-11-13");
  });
  it("valida chaves", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("13/11/2026")).toBe(false);
  });
  it("soma dias atravessando mês", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("dateRange inclusivo", () => {
    expect(dateRange("2026-11-10", "2026-11-12")).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });
});

describe("totais", () => {
  it("soma itens x preço", () => {
    expect(
      computeTotals([
        { priceCents: 500, qty: 3 },
        { priceCents: 250, qty: 2 },
      ]),
    ).toEqual({ totalCents: 2000, totalItems: 5 });
  });
});

describe("buildStats", () => {
  const reg = (date: string, items: [string, number, number][]): RegisterDTO => {
    const its = items.map(([id, price, qty]) => ({
      productId: id,
      name: id,
      category: id === "cafe" ? "Bebidas" : "Salgados",
      emoji: "",
      priceCents: price,
      qty,
    }));
    return { date, status: "closed", items: its, ...computeTotals(its), notes: "", closedAt: null };
  };

  it("agrega dias, ranking e período anterior", () => {
    const s = buildStats(
      "2026-11-10",
      "2026-11-12",
      [reg("2026-11-10", [["cafe", 500, 10], ["coxinha", 700, 2]]), reg("2026-11-12", [["cafe", 500, 4]])],
      [reg("2026-11-08", [["cafe", 500, 1]])],
    );
    expect(s.days).toHaveLength(3);
    expect(s.days[1].status).toBe("empty");
    expect(s.totals).toEqual({ totalCents: 8400, totalItems: 16, activeDays: 2, avgPerDayCents: 4200 });
    expect(s.products[0]).toMatchObject({ productId: "cafe", qty: 14, totalCents: 7000 });
    expect(s.categories[0].category).toBe("Bebidas");
    expect(s.previous.totalCents).toBe(500);
  });
});

describe("safeNextPath", () => {
  it("bloqueia redirecionamento externo", () => {
    expect(safeNextPath("https://mal.com")).toBe("/saida");
    expect(safeNextPath("//mal.com")).toBe("/saida");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });
});

describe("isAdminPath", () => {
  it("separa rotas do dono das rotas do funcionário", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/dashboard")).toBe(true);
    expect(isAdminPath("/api/products/123")).toBe(true);
    expect(isAdminPath("/api/saida/reopen")).toBe(true);
    expect(isAdminPath("/saida")).toBe(false);
    expect(isAdminPath("/api/saida/item")).toBe(false);
    expect(isAdminPath("/administrativo")).toBe(false);
  });
});
