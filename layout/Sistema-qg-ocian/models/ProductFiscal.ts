import { Schema, model, models, type Model, type Types } from "mongoose";

/** Dados fiscais de cada produto (NFC-e). Separado de `products` para não mexer no Admin. */
export interface ProductFiscalRecord {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  ncm: string;
  cfop: string;
  cest: string;
  unit: string;
  origin: string;
  taxCode: string;
}

const ProductFiscalSchema = new Schema<ProductFiscalRecord>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ncm: { type: String, default: "" },
    cfop: { type: String, default: "" },
    cest: { type: String, default: "" },
    unit: { type: String, default: "" },
    origin: { type: String, default: "" },
    taxCode: { type: String, default: "" },
  },
  { timestamps: true },
);

ProductFiscalSchema.index({ productId: 1 }, { unique: true });

export const ProductFiscal: Model<ProductFiscalRecord> =
  (models.ProductFiscal as Model<ProductFiscalRecord>) ||
  model<ProductFiscalRecord>("ProductFiscal", ProductFiscalSchema, "productfiscals");
