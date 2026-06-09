import { Schema, model, models } from "mongoose";


export type ExpenseDoc = {
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  createdBy?: string;
};

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    date: { type: String, required: true, index: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const ExpenseModel = models.Expense || model("Expense", ExpenseSchema);

