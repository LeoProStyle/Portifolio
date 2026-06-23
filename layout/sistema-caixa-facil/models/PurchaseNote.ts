import { Schema, model, models } from "mongoose";

export type PurchaseNoteDoc = {
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  supplier?: string;
  supplierCNPJ?: string;
  supplierAddress?: string;
  supplierNumber?: string;
  supplierNeighborhood?: string;
  supplierMun?: string;
  supplierCity?: string;
  supplierUF?: string;
  supplierCEP?: string;
  emitIE?: string;
  emitCNPJ?: string;
  emitName?: string;
  model?: string;
  serie?: number | string;
  tpEmis?: string;
  cNF?: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  paymentMethod?: string;
  hasFiscalDocument?: boolean;
  documentNumber?: string;
  note?: string;
  active?: boolean;
  createdBy?: string;
};

const PurchaseNoteSchema = new Schema<PurchaseNoteDoc>(
  {
    date: { type: String, required: true, index: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    supplier: { type: String, default: "" },
    supplierCNPJ: { type: String, default: "" },
    supplierAddress: { type: String, default: "" },
    supplierNumber: { type: String, default: "" },
    supplierNeighborhood: { type: String, default: "" },
    supplierMun: { type: String, default: "" },
    supplierCity: { type: String, default: "" },
    supplierUF: { type: String, default: "" },
    supplierCEP: { type: String, default: "" },
    emitIE: { type: String, default: "" },
    emitCNPJ: { type: String, default: "" },
    emitName: { type: String, default: "" },
    model: { type: String, default: "" },
    serie: { type: Schema.Types.Mixed, default: 1 },
    tpEmis: { type: String, default: "1" },
    cNF: { type: String, default: "" },
    ncm: { type: String, default: "" },
    cest: { type: String, default: "" },
    cfop: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    hasFiscalDocument: { type: Boolean, default: false },
    documentNumber: { type: String, default: "" },
    note: { type: String, default: "" },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PurchaseNoteModel = models.PurchaseNote || model("PurchaseNote", PurchaseNoteSchema);
