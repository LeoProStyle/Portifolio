import { Schema, model, models, Document } from "mongoose";

export type FiscalConfigDoc = Document & {
  originalName: string;
  filename: string;
  createdBy?: string;
  active: boolean;
  notes?: string;
};

const FiscalConfigSchema = new Schema<FiscalConfigDoc>(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    createdBy: { type: String, default: "" },
    active: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const FiscalConfigModel = models.FiscalConfig || model("FiscalConfig", FiscalConfigSchema);
