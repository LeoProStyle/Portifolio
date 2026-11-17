import { Schema, model, models, type Model, type Types } from "mongoose";
import type { FiscalEnv, FiscalStatus, ItemFiscalDTO, SaleKind, SaleStatus } from "@/lib/types";

/**
 * Venda do caixa (aba Vendas). Coleção própria, separada da Saída (dailyregisters).
 * Cada item guarda cópia de nome/categoria/preço (e dados fiscais, se fiscal).
 */
export interface SaleItemRecord {
  productId: Types.ObjectId;
  name: string;
  category: string;
  emoji: string;
  unitCents: number;
  qty: number;
  totalCents: number;
  fiscal?: ItemFiscalDTO;
}

export interface SaleFiscalRecord {
  status: FiscalStatus;
  provider: string;
  environment: FiscalEnv;
  ref: string;
  accessKey?: string;
  number?: string;
  series?: string;
  protocol?: string;
  qrCodeUrl?: string;
  consultUrl?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  message?: string;
  attempts: number;
  lastAttemptAt?: Date | null;
}

export interface SaleRecord {
  _id: Types.ObjectId;
  number: number;
  clientRef: string;
  date: string; // YYYY-MM-DD (fuso São Paulo)
  kind: SaleKind;
  items: SaleItemRecord[];
  totalCents: number;
  payments: { method: string; amountCents: number }[];
  receivedCents: number;
  changeCents: number;
  customerDoc: string;
  status: SaleStatus;
  cancelReason: string;
  canceledAt: Date | null;
  createdBy: "admin" | "staff";
  fiscal?: SaleFiscalRecord;
  createdAt: Date;
  updatedAt: Date;
}

const ItemFiscalSchema = new Schema<ItemFiscalDTO>(
  {
    ncm: { type: String, default: "" },
    cfop: { type: String, default: "" },
    cest: { type: String, default: "" },
    unit: { type: String, default: "UN" },
    origin: { type: String, default: "0" },
    taxCode: { type: String, default: "" },
  },
  { _id: false },
);

const ItemSchema = new Schema<SaleItemRecord>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    category: { type: String, default: "Outros" },
    emoji: { type: String, default: "" },
    unitCents: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    totalCents: { type: Number, required: true, min: 0 },
    fiscal: { type: ItemFiscalSchema, default: undefined },
  },
  { _id: false },
);

const FiscalSchema = new Schema<SaleFiscalRecord>(
  {
    status: { type: String, enum: ["pendente", "autorizada", "rejeitada", "erro", "cancelada"], required: true },
    provider: { type: String, required: true },
    environment: { type: String, enum: ["homologacao", "producao"], required: true },
    ref: { type: String, required: true },
    accessKey: { type: String, default: "" },
    number: { type: String, default: "" },
    series: { type: String, default: "" },
    protocol: { type: String, default: "" },
    qrCodeUrl: { type: String, default: "" },
    consultUrl: { type: String, default: "" },
    xmlUrl: { type: String, default: "" },
    danfeUrl: { type: String, default: "" },
    message: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
  },
  { _id: false },
);

const SaleSchema = new Schema<SaleRecord>(
  {
    number: { type: Number, required: true },
    clientRef: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, enum: ["nao_fiscal", "fiscal"], required: true },
    items: { type: [ItemSchema], required: true },
    totalCents: { type: Number, required: true, min: 0 },
    payments: {
      type: [new Schema({ method: { type: String, required: true }, amountCents: { type: Number, required: true } }, { _id: false })],
      required: true,
    },
    receivedCents: { type: Number, default: 0 },
    changeCents: { type: Number, default: 0 },
    customerDoc: { type: String, default: "" },
    status: { type: String, enum: ["concluida", "cancelada"], default: "concluida" },
    cancelReason: { type: String, default: "", maxlength: 255 },
    canceledAt: { type: Date, default: null },
    createdBy: { type: String, enum: ["admin", "staff"], required: true },
    fiscal: { type: FiscalSchema, default: undefined },
  },
  { timestamps: true },
);

SaleSchema.index({ number: 1 }, { unique: true });
SaleSchema.index({ clientRef: 1 }, { unique: true });
SaleSchema.index({ date: 1, number: 1 });
SaleSchema.index({ "fiscal.status": 1 });

export const Sale: Model<SaleRecord> = (models.Sale as Model<SaleRecord>) || model<SaleRecord>("Sale", SaleSchema);
