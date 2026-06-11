import { Schema, model, models, Document, Types } from "mongoose";

export type FiscalDocumentDoc = Document & {
  fiscalConfigId?: Types.ObjectId | string;
  type: string;
  status: "draft" | "pending" | "sent" | "failed";
  payload?: Record<string, any>;
  notes?: string;
};

const FiscalDocumentSchema = new Schema<FiscalDocumentDoc>(
  {
    fiscalConfigId: { type: Schema.Types.ObjectId, ref: "FiscalConfig" },
    type: { type: String, required: true },
    status: { type: String, enum: ["draft", "pending", "sent", "failed"], default: "draft" },
    payload: { type: Schema.Types.Mixed },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const FiscalDocumentModel = models.FiscalDocument || model("FiscalDocument", FiscalDocumentSchema);
