import { Schema, model, models, type Model } from "mongoose";
import type { PartyDTO } from "@/lib/types";

/** Configuração fiscal da loja (documento único, _id "default"). Token do provedor NÃO fica aqui (só no env). */
export interface FiscalSettingsRecord {
  _id: string;
  company: PartyDTO;
  tradeName: string;
  receiptFooter: string;
  defaults: { cfop: string; taxCode: string; origin: string; unit: string };
  updatedAt: Date;
}

const CompanySchema = new Schema<PartyDTO>(
  {
    doc: { type: String, default: "" },
    name: { type: String, default: "QG Ocian" },
    ie: { type: String, default: "" },
    crt: { type: String, enum: ["1", "2", "3", "4"], default: "1" },
    ieIndicator: { type: String, enum: ["1", "2", "9"], default: "9" },
    street: { type: String, default: "" },
    number: { type: String, default: "" },
    district: { type: String, default: "" },
    cityCode: { type: String, default: "" },
    city: { type: String, default: "" },
    uf: { type: String, default: "SP" },
    cep: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false },
);

const FiscalSettingsSchema = new Schema<FiscalSettingsRecord>(
  {
    _id: { type: String, default: "default" },
    company: { type: CompanySchema, default: () => ({}) },
    tradeName: { type: String, default: "" },
    receiptFooter: { type: String, default: "" },
    defaults: {
      cfop: { type: String, default: "5102" },
      taxCode: { type: String, default: "102" },
      origin: { type: String, default: "0" },
      unit: { type: String, default: "UN" },
    },
  },
  { timestamps: true, versionKey: false },
);

export const FiscalSettings: Model<FiscalSettingsRecord> =
  (models.FiscalSettings as Model<FiscalSettingsRecord>) ||
  model<FiscalSettingsRecord>("FiscalSettings", FiscalSettingsSchema, "fiscalsettings");
