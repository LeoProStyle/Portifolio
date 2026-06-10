import { Schema, model, models } from "mongoose";

export type ProductDoc = {
  code: string;
  name: string;
  category: string;
  salePrice: number;
  cost: number;
  stockCurrent: number;
  stockMin: number;
  active: boolean;
};

const ProductSchema = new Schema<ProductDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    salePrice: { type: Number, required: true, default: 0 },
    cost: { type: Number, required: true, default: 0 },
    stockCurrent: { type: Number, default: 0 },
    stockMin: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ProductModel = models.Product || model("Product", ProductSchema);
