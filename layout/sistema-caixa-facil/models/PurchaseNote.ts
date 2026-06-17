import { Schema, model, models } from "mongoose";

export type PurchaseNoteDoc = {
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  supplier?: string;
  emitCNPJ?: string;
  emitName?: string;
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
    emitCNPJ: { type: String, default: "" },
    emitName: { type: String, default: "" },
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
