import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ProductRecord {
  _id: Types.ObjectId;
  name: string;
  category: string;
  priceCents: number;
  emoji: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, required: true, trim: true, maxlength: 40, default: "Outros" },
    priceCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "Preço inválido" },
    },
    emoji: { type: String, trim: true, maxlength: 16, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Nome único sem diferenciar maiúsculas/acentos ("Café" == "cafe")
ProductSchema.index({ name: 1 }, { unique: true, collation: { locale: "pt", strength: 1 } });
ProductSchema.index({ active: 1, category: 1, sortOrder: 1 });

export const Product: Model<ProductRecord> =
  (models.Product as Model<ProductRecord>) || model<ProductRecord>("Product", ProductSchema);
