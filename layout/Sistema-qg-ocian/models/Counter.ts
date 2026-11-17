import { Schema, model, models, type Model } from "mongoose";

/** Contadores sequenciais (ex.: número da venda). */
export interface CounterRecord {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<CounterRecord>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter: Model<CounterRecord> =
  (models.Counter as Model<CounterRecord>) || model<CounterRecord>("Counter", CounterSchema);

/** Próximo número da sequência — atômico ($inc), seguro com vários caixas ao mesmo tempo. */
export async function nextSeq(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return doc!.seq;
}
