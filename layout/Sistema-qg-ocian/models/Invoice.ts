import { Schema, model, models, type Model, type Types } from "mongoose";
import type { InvoiceItemDTO, InvoiceKind, InvoicePaymentDTO, PartyDTO } from "@/lib/types";

/**
 * Cupom fiscal ou não fiscal recebido pela loja (base para exportar o XML no layout NF-e 4.00).
 * Valores em centavos; quantidade com até 4 casas.
 */
export interface InvoiceRecord {
  _id: Types.ObjectId;
  kind: InvoiceKind;
  model: "55" | "65";
  series: number;
  number: number;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm
  natOp: string;
  accessKey: string;
  cNF: string;
  emitter: PartyDTO;
  recipient: PartyDTO;
  items: InvoiceItemDTO[];
  payments: InvoicePaymentDTO[];
  totalCents: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema = new Schema<PartyDTO>(
  {
    doc: { type: String, default: "" },
    name: { type: String, required: true },
    ie: { type: String, default: "" },
    crt: { type: String, enum: ["1", "2", "3", "4"], default: "3" },
    ieIndicator: { type: String, enum: ["1", "2", "9"], default: "9" },
    street: { type: String, default: "" },
    number: { type: String, default: "" },
    district: { type: String, default: "" },
    cityCode: { type: String, default: "" },
    city: { type: String, default: "" },
    uf: { type: String, required: true },
    cep: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false },
);

const ItemSchema = new Schema<InvoiceItemDTO>(
  {
    code: { type: String, default: "" },
    ean: { type: String, default: "" },
    description: { type: String, required: true },
    ncm: { type: String, default: "00000000" },
    cest: { type: String, default: "" },
    cfop: { type: String, default: "" },
    unit: { type: String, default: "un" },
    qty: { type: Number, required: true, min: 0 },
    unitCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PaymentSchema = new Schema<InvoicePaymentDTO>(
  { method: { type: String, required: true }, amountCents: { type: Number, required: true, min: 0 } },
  { _id: false },
);

const InvoiceSchema = new Schema<InvoiceRecord>(
  {
    kind: { type: String, required: true, enum: ["fiscal", "nao_fiscal"] },
    model: { type: String, required: true, enum: ["55", "65"] },
    series: { type: Number, required: true, min: 0 },
    number: { type: Number, required: true, min: 1 },
    issueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    issueTime: { type: String, default: "00:00" },
    natOp: { type: String, default: "VENDA" },
    accessKey: { type: String, default: "" },
    cNF: { type: String, required: true },
    emitter: { type: PartySchema, required: true },
    recipient: { type: PartySchema, required: true },
    items: { type: [ItemSchema], default: [] },
    payments: { type: [PaymentSchema], default: [] },
    totalCents: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);

InvoiceSchema.index({ issueDate: -1 });
// o mesmo cupom fiscal (emitente + modelo + série + número) não pode ser cadastrado duas vezes
InvoiceSchema.index(
  { "emitter.doc": 1, model: 1, series: 1, number: 1 },
  { unique: true, partialFilterExpression: { kind: "fiscal" }, name: "fiscal_unique" },
);

export const Invoice: Model<InvoiceRecord> =
  (models.Invoice as Model<InvoiceRecord>) || model<InvoiceRecord>("Invoice", InvoiceSchema);
