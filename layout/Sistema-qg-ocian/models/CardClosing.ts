import { Schema, model, models, type Model, type Types } from "mongoose";

/** Fechamento diário da maquininha (um documento por dia). Valores em centavos. */
export interface CardClosingRecord {
  _id: Types.ObjectId;
  date: string; // YYYY-MM-DD (fuso São Paulo)
  debitCents: number;
  creditCents: number;
  pixCents: number;
  voucherCents: number;
  feesCents: number;
  totalCents: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const cents = { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: "Valor inválido" } };

const CardClosingSchema = new Schema<CardClosingRecord>(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    debitCents: cents,
    creditCents: cents,
    pixCents: cents,
    voucherCents: cents,
    feesCents: cents,
    totalCents: cents,
    notes: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true, collection: "cardclosings" },
);

export const CardClosing: Model<CardClosingRecord> =
  (models.CardClosing as Model<CardClosingRecord>) || model<CardClosingRecord>("CardClosing", CardClosingSchema);
