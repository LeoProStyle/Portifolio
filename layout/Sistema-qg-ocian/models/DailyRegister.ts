import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Registro de saída de produtos de um dia (um documento por dia).
 * Cada item guarda uma cópia do nome/categoria/preço do produto para que o histórico
 * não mude se o produto for editado ou removido depois.
 */
export interface RegisterItemRecord {
  productId: Types.ObjectId;
  name: string;
  category: string;
  emoji: string;
  priceCents: number;
  qty: number;
}

export interface DailyRegisterRecord {
  _id: Types.ObjectId;
  date: string; // YYYY-MM-DD (fuso São Paulo)
  status: "open" | "closed";
  items: RegisterItemRecord[];
  totalCents: number;
  totalItems: number;
  notes: string;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<RegisterItemRecord>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    category: { type: String, default: "Outros" },
    emoji: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const DailyRegisterSchema = new Schema<DailyRegisterRecord>(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    items: { type: [ItemSchema], default: [] },
    totalCents: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    notes: { type: String, default: "", maxlength: 1000 },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

DailyRegisterSchema.index({ status: 1, date: -1 });
DailyRegisterSchema.index({ "items.productId": 1 });

export const DailyRegister: Model<DailyRegisterRecord> =
  (models.DailyRegister as Model<DailyRegisterRecord>) ||
  model<DailyRegisterRecord>("DailyRegister", DailyRegisterSchema);
