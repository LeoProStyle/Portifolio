import { describe, expect, it } from "vitest";
import { isAdminPath } from "@/lib/auth";
import {
  canCancel,
  computeReadiness,
  dayTotals,
  priceItems,
  settlePayments,
  type CatalogProduct,
} from "@/lib/sales-rules";
import { SaleInput } from "@/lib/validation";
import type { SaleDTO } from "@/lib/types";
import { Types } from "mongoose";
import { toFiscalSettingsDTO, toSaleDTO } from "@/lib/serializers";

describe("vendas: acesso", () => {
  it("configuração fiscal é só do dono; caixa não", () => {
    expect(isAdminPath("/vendas/config")).toBe(true);
    expect(isAdminPath("/api/vendas/config")).toBe(true);
    expect(isAdminPath("/vendas")).toBe(false);
    expect(isAdminPath("/api/vendas")).toBe(false);
    expect(isAdminPath("/api/vendas/abc/cancel")).toBe(false);
  });
});

const prod = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: "p1",
  name: "Café",
  category: "Bebidas",
  emoji: "☕",
  priceCents: 500,
  active: true,
  ...over,
});

describe("priceItems", () => {
  it("usa o preço do banco e soma linhas repetidas", () => {
    const items = priceItems(
      [
        { productId: "p1", qty: 1 },
        { productId: "p1", qty: 2 },
      ],
      new Map([["p1", prod()]]),
    );
    expect(items).toEqual([expect.objectContaining({ productId: "p1", qty: 3, unitCents: 500, totalCents: 1500 })]);
  });
  it("recusa produto inexistente", () => {
    expect(() => priceItems([{ productId: "x", qty: 1 }], new Map())).toThrow("Produto não encontrado");
  });
  it("recusa produto desativado com o nome", () => {
    expect(() => priceItems([{ productId: "p1", qty: 1 }], new Map([["p1", prod({ active: false })]]))).toThrow(
      '"Café" está desativado',
    );
  });
  it("preenche fiscal com padrões, mas não inventa NCM", () => {
    const [it0] = priceItems([{ productId: "p1", qty: 1 }], new Map([["p1", prod()]]), {
      byProduct: new Map(),
      defaults: { cfop: "5102", taxCode: "102", origin: "0", unit: "UN" },
    });
    expect(it0.fiscal).toEqual({ ncm: "", cfop: "5102", cest: "", unit: "UN", origin: "0", taxCode: "102" });
  });
  it("usa a configuração do produto quando existe", () => {
    const [it0] = priceItems([{ productId: "p1", qty: 1 }], new Map([["p1", prod()]]), {
      byProduct: new Map([["p1", { productId: "p1", ncm: "21069090", cfop: "", cest: "", unit: "UN", origin: "", taxCode: "500" }]]),
      defaults: { cfop: "5102", taxCode: "102", origin: "0", unit: "UN" },
    });
    expect(it0.fiscal).toMatchObject({ ncm: "21069090", cfop: "5102", taxCode: "500", origin: "0" });
  });
});

describe("settlePayments", () => {
  it("troco só sobre o dinheiro", () => {
    expect(
      settlePayments(
        3500,
        [
          { method: "01", amountCents: 2000 },
          { method: "04", amountCents: 1500 },
        ],
        5000,
      ),
    ).toEqual({
      payments: [
        { method: "01", amountCents: 2000 },
        { method: "04", amountCents: 1500 },
      ],
      receivedCents: 5000,
      changeCents: 3000,
    });
  });
  it("recusa recebido menor que a parte em dinheiro", () => {
    expect(() =>
      settlePayments(
        3500,
        [
          { method: "01", amountCents: 2000 },
          { method: "04", amountCents: 1500 },
        ],
        1000,
      ),
    ).toThrow("Valor recebido em dinheiro menor");
  });
  it("recusa soma diferente do total", () => {
    expect(() => settlePayments(3500, [{ method: "17", amountCents: 3000 }])).toThrow("soma dos pagamentos");
  });
  it("sem dinheiro não há troco", () => {
    expect(settlePayments(500, [{ method: "17", amountCents: 500 }], 9999)).toMatchObject({ receivedCents: 0, changeCents: 0 });
  });
  it("dinheiro sem valor recebido = valor exato", () => {
    expect(settlePayments(500, [{ method: "01", amountCents: 500 }])).toMatchObject({ receivedCents: 500, changeCents: 0 });
  });
  it("agrupa a mesma forma de pagamento", () => {
    expect(
      settlePayments(1000, [
        { method: "17", amountCents: 400 },
        { method: "17", amountCents: 600 },
      ]).payments,
    ).toEqual([{ method: "17", amountCents: 1000 }]);
  });
});

describe("canCancel", () => {
  it("staff só hoje; admin qualquer dia; cancelada nunca", () => {
    expect(canCancel("staff", { date: "2026-11-16", status: "concluida" }, "2026-11-17")).toMatch(/Só o dono/);
    expect(canCancel("staff", { date: "2026-11-17", status: "concluida" }, "2026-11-17")).toBeNull();
    expect(canCancel("admin", { date: "2026-11-01", status: "concluida" }, "2026-11-17")).toBeNull();
    expect(canCancel("admin", { date: "2026-11-17", status: "cancelada" }, "2026-11-17")).toMatch(/já cancelada/);
  });
});

describe("computeReadiness", () => {
  const settings = {
    company: {
      doc: "11222333000181",
      name: "QG Ocian LTDA",
      ie: "123456789",
      crt: "1" as const,
      ieIndicator: "9" as const,
      street: "",
      number: "",
      district: "",
      cityCode: "",
      city: "",
      uf: "SP",
      cep: "",
      phone: "",
    },
    tradeName: "QG Ocian",
    receiptFooter: "",
    defaults: { cfop: "5102", taxCode: "102", origin: "0", unit: "UN" },
  };
  it("desligado sem provedor; lista produtos sem NCM", () => {
    const r = computeReadiness({ provider: null, environment: null, settings: null, products: [prod()], fiscal: [] });
    expect(r.enabled).toBe(false);
    expect(r.reasons).toContain("Provedor fiscal não configurado");
    expect(r.missingNcm).toEqual(["p1"]);
  });
  it("exige CNPJ e IE da empresa", () => {
    const r = computeReadiness({
      provider: "mock",
      environment: "homologacao",
      settings: { ...settings, company: { ...settings.company, doc: "", ie: "" } },
      products: [],
      fiscal: [],
    });
    expect(r.reasons).toEqual(["Informe o CNPJ da empresa na Configuração fiscal", "Informe a IE da empresa"]);
  });
  it("liberado com provedor e empresa; ignora inativos em missingNcm", () => {
    const r = computeReadiness({
      provider: "mock",
      environment: "homologacao",
      settings,
      products: [prod(), prod({ id: "p2", active: false })],
      fiscal: [{ productId: "p1", ncm: "21069090", cfop: "", cest: "", unit: "", origin: "", taxCode: "" }],
    });
    expect(r).toEqual({ enabled: true, provider: "mock", environment: "homologacao", reasons: [], missingNcm: [] });
  });
});

describe("dayTotals", () => {
  const sale = (over: Partial<SaleDTO>): SaleDTO => ({
    id: "s",
    number: 1,
    date: "2026-11-17",
    createdAt: "",
    kind: "nao_fiscal",
    items: [],
    totalCents: 0,
    payments: [],
    receivedCents: 0,
    changeCents: 0,
    customerDoc: "",
    status: "concluida",
    cancelReason: "",
    canceledAt: null,
    fiscal: null,
    ...over,
  });
  it("ignora canceladas e soma por forma na ordem do caixa", () => {
    const t = dayTotals([
      sale({ totalCents: 1000, payments: [{ method: "04", amountCents: 1000 }] }),
      sale({ totalCents: 500, payments: [{ method: "01", amountCents: 300 }, { method: "04", amountCents: 200 }] }),
      sale({ totalCents: 9000, status: "cancelada", payments: [{ method: "17", amountCents: 9000 }] }),
    ]);
    expect(t).toEqual({
      count: 2,
      totalCents: 1500,
      byMethod: [
        { method: "01", amountCents: 300 },
        { method: "04", amountCents: 1200 },
      ],
    });
  });
});

describe("serializers de vendas", () => {
  it("configuração vazia vira os padrões da loja", () => {
    const s = toFiscalSettingsDTO(null);
    expect(s.defaults).toEqual({ cfop: "5102", taxCode: "102", origin: "0", unit: "UN" });
    expect(s.company).toMatchObject({ name: "QG Ocian", uf: "SP", crt: "1", doc: "" });
  });
  it("venda sem fiscal e sem cancelamento", () => {
    const createdAt = new Date("2026-11-17T17:32:00.000Z");
    const dto = toSaleDTO({
      _id: new Types.ObjectId("65a000000000000000000001"),
      number: 7,
      clientRef: "abcdefgh",
      date: "2026-11-17",
      kind: "nao_fiscal",
      items: [{ productId: new Types.ObjectId("65a000000000000000000002"), name: "Café", category: "Bebidas", emoji: "☕", unitCents: 500, qty: 2, totalCents: 1000 }],
      totalCents: 1000,
      payments: [{ method: "17", amountCents: 1000 }],
      receivedCents: 0,
      changeCents: 0,
      customerDoc: "",
      status: "concluida",
      cancelReason: "",
      canceledAt: null,
      createdBy: "staff",
      createdAt,
      updatedAt: createdAt,
    });
    expect(dto).toMatchObject({ id: "65a000000000000000000001", number: 7, fiscal: null, canceledAt: null, createdAt: createdAt.toISOString() });
    expect(dto.items[0]).toEqual({ productId: "65a000000000000000000002", name: "Café", category: "Bebidas", emoji: "☕", unitCents: 500, qty: 2, totalCents: 1000 });
  });
});

describe("SaleInput", () => {
  const base = { clientRef: "abcdefgh", items: [{ productId: "p1", qty: 1 }], payments: [{ method: "17", amountCents: 500 }] };
  it("descarta CPF quando não fiscal e valida quando fiscal", () => {
    expect(SaleInput.parse({ ...base, kind: "nao_fiscal", customerDoc: "123" }).customerDoc).toBe("");
    expect(() => SaleInput.parse({ ...base, kind: "fiscal", customerDoc: "11111111111" })).toThrow();
    expect(SaleInput.parse({ ...base, kind: "fiscal", customerDoc: "529.982.247-25" }).customerDoc).toBe("52998224725");
  });
  it("recusa forma de pagamento fora do caixa", () => {
    expect(() => SaleInput.parse({ ...base, kind: "nao_fiscal", payments: [{ method: "02", amountCents: 500 }] })).toThrow();
  });
});
