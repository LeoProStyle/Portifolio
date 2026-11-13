import { Schema, model, models, type Model, type Types } from "mongoose";
import type { ExpensePayment, ExpenseType } from "@/lib/types";

/** Despesa, compra no cartão de crédito ou suprimento da loja. Valor em centavos. */
export interface ExpenseRecord {
  _id: Types.ObjectId;
  date: string; // YYYY-MM-DD
  type: ExpenseType;
  category: string;
  description: string;
  supplier: string;
  amountCents: number;
  paymentMethod: ExpensePayment;
  installments: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseRecord>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, required: true, enum: ["despesa", "cartao", "suprimento"] },
    category: { type: String, default: "", trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 120 },
    supplier: { type: String, default: "", trim: true, maxlength: 80 },
    amountCents: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Valor inválido" } },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["dinheiro", "pix", "debito", "credito", "boleto", "transferencia", "outro"],
    },
    installments: { type: Number, default: 1, min: 1, max: 48 },
    notes: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ type: 1, date: -1 });

export const Expense: Model<ExpenseRecord> =
  (models.Expense as Model<ExpenseRecord>) || model<ExpenseRecord>("Expense", ExpenseSchema);
