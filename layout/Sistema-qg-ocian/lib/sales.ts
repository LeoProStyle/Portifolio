/**
 * Serviço do caixa (aba Vendas): cria, lista, cancela e emite NFC-e.
 * Regras puras em `sales-rules.ts`; aqui fica o banco e o provedor fiscal.
 */
import { Types } from "mongoose";
import type { z } from "zod";
import { ApiError } from "./api";
import type { Role } from "./auth";
import { connectDB } from "./db";
import { todayKey } from "./date";
import { formatDoc } from "./fiscal";
import { getFiscalProvider } from "./fiscal-provider";
import type { FiscalResult } from "./fiscal-provider";
import { canCancel, computeReadiness, dayTotals, priceItems, SaleError, settlePayments, type CatalogProduct } from "./sales-rules";
import { toFiscalSettingsDTO, toProductDTO, toProductFiscalDTO, toSaleDTO } from "./serializers";
import type {
  FiscalConfigResponse,
  FiscalReadiness,
  FiscalSettingsDTO,
  ProductFiscalDTO,
  ReceiptCompany,
  SaleDTO,
  SaleReceiptResponse,
  SalesDayResponse,
  VendasCatalogResponse,
} from "./types";
import type { CancelSaleInput, FiscalConfigInput, SaleInput } from "./validation";
import { nextSeq } from "@/models/Counter";
import { FiscalSettings, type FiscalSettingsRecord } from "@/models/FiscalSettings";
import { Product, type ProductRecord } from "@/models/Product";
import { ProductFiscal, type ProductFiscalRecord } from "@/models/ProductFiscal";
import { Sale, type SaleRecord } from "@/models/Sale";

const MIN_FISCAL_CANCEL_REASON = 15;

/** Converte erro de regra em erro HTTP com o mesmo status. */
function rules<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof SaleError) throw new ApiError(err.status, err.message);
    throw err;
  }
}

const toCatalog = (p: ProductRecord): CatalogProduct => ({
  id: String(p._id),
  name: p.name,
  category: p.category,
  emoji: p.emoji ?? "",
  priceCents: p.priceCents,
  active: p.active,
});

async function loadSettings(): Promise<FiscalSettingsDTO> {
  return toFiscalSettingsDTO(await FiscalSettings.findById("default").lean<FiscalSettingsRecord>());
}

async function loadProductFiscal(): Promise<ProductFiscalDTO[]> {
  return (await ProductFiscal.find().lean<ProductFiscalRecord[]>()).map(toProductFiscalDTO);
}

async function activeProducts(): Promise<ProductRecord[]> {
  return Product.find({ active: true }).collation({ locale: "pt" }).sort({ category: 1, sortOrder: 1, name: 1 }).lean<ProductRecord[]>();
}

function readinessFor(products: ProductRecord[], settings: FiscalSettingsDTO, fiscal: ProductFiscalDTO[]): FiscalReadiness {
  const provider = getFiscalProvider();
  return computeReadiness({
    provider: provider?.name ?? null,
    environment: provider?.environment ?? null,
    settings,
    products: products.map(toCatalog),
    fiscal,
  });
}

function saleId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Venda não encontrada.");
  return new Types.ObjectId(id);
}

async function findSale(id: string): Promise<SaleRecord> {
  const doc = await Sale.findById(saleId(id)).lean<SaleRecord>();
  if (!doc) throw new ApiError(404, "Venda não encontrada.");
  return doc;
}

/* ---------------- Caixa ---------------- */

export async function getCatalog(role: Role): Promise<VendasCatalogResponse> {
  await connectDB();
  const [products, settings, fiscal] = await Promise.all([activeProducts(), loadSettings(), loadProductFiscal()]);
  return { today: todayKey(), role, products: products.map(toProductDTO), readiness: readinessFor(products, settings, fiscal) };
}

export async function createSale(input: z.output<typeof SaleInput>, role: Role): Promise<SaleDTO> {
  await connectDB();
  const existing = await Sale.findOne({ clientRef: input.clientRef }).lean<SaleRecord>();
  if (existing) return toSaleDTO(existing);

  const ids = [...new Set(input.items.map((i) => i.productId))];
  if (ids.some((id) => !Types.ObjectId.isValid(id))) throw new ApiError(400, "Produto não encontrado");
  const docs = await Product.find({ _id: { $in: ids } }).lean<ProductRecord[]>();
  const catalog = new Map(docs.map((p) => [String(p._id), toCatalog(p)]));

  const fiscal = input.kind === "fiscal";
  let fiscalCtx: Parameters<typeof priceItems>[2];
  let provider = null as ReturnType<typeof getFiscalProvider>;
  if (fiscal) {
    const [settings, rows, active] = await Promise.all([loadSettings(), loadProductFiscal(), activeProducts()]);
    const readiness = readinessFor(active, settings, rows);
    if (!readiness.enabled) throw new ApiError(409, readiness.reasons[0]);
    provider = getFiscalProvider();
    fiscalCtx = { byProduct: new Map(rows.map((r) => [r.productId, r])), defaults: settings.defaults };
  }

  const items = rules(() => priceItems(input.items, catalog, fiscalCtx));
  const noNcm = fiscal ? items.find((i) => !i.fiscal?.ncm) : undefined;
  if (noNcm) throw new ApiError(409, `"${noNcm.name}" sem NCM — preencha na Configuração fiscal`);

  const totalCents = items.reduce((acc, i) => acc + i.totalCents, 0);
  const pay = rules(() => settlePayments(totalCents, input.payments, input.receivedCents));

  const _id = new Types.ObjectId();
  // o índice único de clientRef é o que barra o clique duplo: garante que ele existe (uma vez por processo)
  await Sale.init();
  try {
    await Sale.create({
      _id,
      number: await nextSeq("sale"),
      clientRef: input.clientRef,
      date: todayKey(),
      kind: input.kind,
      items: items.map((i) => ({ ...i, productId: new Types.ObjectId(i.productId) })),
      totalCents,
      ...pay,
      customerDoc: input.customerDoc,
      createdBy: role,
      ...(fiscal && provider
        ? { fiscal: { status: "pendente", provider: provider.name, environment: provider.environment, ref: String(_id), attempts: 0 } }
        : {}),
    });
  } catch (err) {
    // clique duplo: a outra requisição gravou primeiro com o mesmo clientRef
    if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
      const winner = await Sale.findOne({ clientRef: input.clientRef }).lean<SaleRecord>();
      if (winner) return toSaleDTO(winner);
    }
    throw err;
  }

  return fiscal ? emitFiscal(String(_id)) : toSaleDTO(await findSale(String(_id)));
}

/** Envia (ou reconsulta) a NFC-e da venda e grava o resultado. Nunca emite em dobro: tentativa > 0 consulta antes. */
async function emitFiscal(id: string): Promise<SaleDTO> {
  const sale = await findSale(id);
  const ref = sale.fiscal?.ref ?? id;
  const provider = getFiscalProvider();
  let result: FiscalResult;

  if (!provider) {
    result = { status: "erro", accessKey: "", number: "", series: "", protocol: "", qrCodeUrl: "", consultUrl: "", xmlUrl: "", danfeUrl: "", message: "Provedor fiscal não configurado" };
  } else {
    const previous = (sale.fiscal?.attempts ?? 0) > 0 ? await provider.consult(ref) : null;
    if (previous && previous.status !== "rejeitada" && previous.status !== "erro") {
      result = previous;
    } else {
      result = await provider.emit(ref, toSaleDTO(sale), await loadSettings());
    }
  }

  const doc = await Sale.findByIdAndUpdate(
    sale._id,
    {
      $set: {
        "fiscal.status": result.status,
        "fiscal.accessKey": result.accessKey,
        "fiscal.number": result.number,
        "fiscal.series": result.series,
        "fiscal.protocol": result.protocol,
        "fiscal.qrCodeUrl": result.qrCodeUrl,
        "fiscal.consultUrl": result.consultUrl,
        "fiscal.xmlUrl": result.xmlUrl,
        "fiscal.danfeUrl": result.danfeUrl,
        "fiscal.message": result.message,
        "fiscal.lastAttemptAt": new Date(),
      },
      $inc: { "fiscal.attempts": 1 },
    },
    { returnDocument: "after" },
  ).lean<SaleRecord>();
  return toSaleDTO(doc!);
}

export async function retryFiscal(id: string): Promise<SaleDTO> {
  await connectDB();
  const sale = await findSale(id);
  if (sale.kind !== "fiscal" || !sale.fiscal || sale.status !== "concluida" || !["erro", "rejeitada", "pendente"].includes(sale.fiscal.status)) {
    throw new ApiError(409, "Esta venda não tem cupom fiscal para reenviar.");
  }
  if (sale.fiscal.status === "rejeitada") {
    // a rejeição costuma ser de cadastro: reenvia com a configuração fiscal atual
    const [settings, rows] = await Promise.all([loadSettings(), loadProductFiscal()]);
    const byProduct = new Map(rows.map((r) => [r.productId, r]));
    const d = settings.defaults;
    const items = sale.items.map((it) => {
      const f = byProduct.get(String(it.productId));
      return { ...it, fiscal: { ncm: f?.ncm || "", cfop: f?.cfop || d.cfop, cest: f?.cest || "", unit: f?.unit || d.unit, origin: f?.origin || d.origin, taxCode: f?.taxCode || d.taxCode } };
    });
    await Sale.updateOne({ _id: sale._id }, { $set: { items } });
  }
  return emitFiscal(id);
}

export async function listSales(date: string): Promise<SalesDayResponse> {
  await connectDB();
  const docs = await Sale.find({ date }).sort({ number: -1 }).lean<SaleRecord[]>();
  const sales = docs.map(toSaleDTO);
  return { date, today: todayKey(), sales, totals: dayTotals(sales) };
}

function receiptCompany(s: FiscalSettingsDTO): ReceiptCompany {
  const c = s.company;
  const street = [c.street, c.number].filter(Boolean).join(", ");
  // só a UF (padrão "SP") sem cidade não diz nada no comprovante
  const city = c.city ? [c.city, c.uf].filter(Boolean).join("/") : "";
  return {
    name: s.tradeName || c.name || "QG Ocian",
    doc: c.doc ? formatDoc(c.doc) : "",
    address: [street, c.district, city].filter(Boolean).join(" – "),
    phone: c.phone,
    footer: s.receiptFooter,
  };
}

export async function getSaleReceipt(id: string): Promise<SaleReceiptResponse> {
  await connectDB();
  const [sale, settings] = await Promise.all([findSale(id), loadSettings()]);
  return { sale: toSaleDTO(sale), company: receiptCompany(settings) };
}

export async function cancelSale(id: string, input: z.output<typeof CancelSaleInput>, role: Role): Promise<SaleDTO> {
  await connectDB();
  const sale = await findSale(id);
  const blocked = canCancel(role, { date: sale.date, status: sale.status }, todayKey());
  if (blocked) throw new ApiError(sale.status === "cancelada" ? 409 : 403, blocked);

  let authorized = sale.fiscal?.status === "autorizada";
  if (sale.fiscal && (sale.fiscal.status === "erro" || sale.fiscal.status === "pendente")) {
    // "sem resposta" pode ser nota emitida: confirma no provedor antes de cancelar só aqui
    const provider = getFiscalProvider();
    if (!provider) throw new ApiError(409, "Provedor fiscal não configurado — não dá para confirmar se a NFC-e foi emitida.");
    const current = await provider.consult(sale.fiscal.ref);
    if (current?.status === "erro" || current?.status === "pendente") {
      throw new ApiError(409, "Não foi possível confirmar a NFC-e no provedor. Use “Tentar de novo” e cancele depois.");
    }
    authorized = current?.status === "autorizada";
  }
  if (authorized) {
    if (input.reason.length < MIN_FISCAL_CANCEL_REASON) {
      throw new ApiError(400, `Motivo do cancelamento fiscal precisa de ao menos ${MIN_FISCAL_CANCEL_REASON} caracteres`);
    }
    const provider = getFiscalProvider();
    if (!provider) throw new ApiError(409, "Provedor fiscal não configurado — não é possível cancelar a NFC-e.");
    const res = await provider.cancel(sale.fiscal!.ref, input.reason);
    if (!res.ok) throw new ApiError(409, res.message || "O provedor recusou o cancelamento.");
  }

  const doc = await Sale.findOneAndUpdate(
    { _id: sale._id, status: "concluida" },
    { $set: { status: "cancelada", cancelReason: input.reason, canceledAt: new Date(), ...(authorized ? { "fiscal.status": "cancelada" } : {}) } },
    { returnDocument: "after" },
  ).lean<SaleRecord>();
  if (!doc) throw new ApiError(409, "Venda já cancelada");
  return toSaleDTO(doc);
}

/* ---------------- Configuração fiscal (dono) ---------------- */

export async function getFiscalConfig(): Promise<FiscalConfigResponse> {
  await connectDB();
  const [settings, fiscal, all] = await Promise.all([
    loadSettings(),
    loadProductFiscal(),
    Product.find().collation({ locale: "pt" }).sort({ active: -1, category: 1, sortOrder: 1, name: 1 }).lean<ProductRecord[]>(),
  ]);
  return {
    settings,
    products: all.map(toProductDTO),
    fiscal,
    readiness: readinessFor(all.filter((p) => p.active), settings, fiscal),
  };
}

export async function saveFiscalConfig(input: z.output<typeof FiscalConfigInput>): Promise<FiscalConfigResponse> {
  await connectDB();
  if (input.products.some((p) => !Types.ObjectId.isValid(p.productId))) throw new ApiError(400, "Produto inválido.");
  await FiscalSettings.findByIdAndUpdate("default", { $set: input.settings }, { upsert: true, runValidators: true });
  if (input.products.length) {
    await ProductFiscal.bulkWrite(
      input.products.map(({ productId, ...data }) => ({
        updateOne: { filter: { productId: new Types.ObjectId(productId) }, update: { $set: data }, upsert: true },
      })),
    );
  }
  return getFiscalConfig();
}
