import { Schema, model, models } from "mongoose";


export type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

export type CashClosureDoc = {
  date: string; // YYYY-MM-DD
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  total: number;
  observacao?: string;
  createdBy?: string;
};

const CashClosureSchema = new Schema<CashClosureDoc>(
  {
    date: { type: String, required: true, index: true },
    dinheiro: { type: Number, default: 0 },
    pix: { type: Number, default: 0 },
    cartao_credito: { type: Number, default: 0 },
    cartao_debito: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    observacao: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const CashClosureModel = models.CashClosure || model("CashClosure", CashClosureSchema);

