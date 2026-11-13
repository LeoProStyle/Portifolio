import { Types } from "mongoose";
import { connectDB } from "./db";
import { ApiError } from "./api";
import { computeTotals, emptyRegister, toRegisterDTO } from "./serializers";
import { DailyRegister, type DailyRegisterRecord } from "@/models/DailyRegister";
import { Product } from "@/models/Product";
import type { RegisterDTO } from "./types";

/** Regras da aba "Saída de produtos". */

export async function findRegister(date: string): Promise<RegisterDTO> {
  await connectDB();
  const doc = await DailyRegister.findOne({ date }).lean<DailyRegisterRecord>();
  return doc ? toRegisterDTO(doc) : emptyRegister(date);
}

async function ensureRegister(date: string): Promise<DailyRegisterRecord> {
  try {
    const doc = await DailyRegister.findOneAndUpdate(
      { date },
      { $setOnInsert: { date, status: "open", items: [], notes: "" } },
      { upsert: true, returnDocument: "after" },
    ).lean<DailyRegisterRecord>();
    if (doc) return doc;
  } catch (err) {
    // Duas requisições criando o mesmo dia ao mesmo tempo: a segunda só lê.
    if (!(typeof err === "object" && err && "code" in err && err.code === 11000)) throw err;
  }
  const doc = await DailyRegister.findOne({ date }).lean<DailyRegisterRecord>();
  if (!doc) throw new ApiError(500, "Não foi possível abrir o dia.");
  return doc;
}

/** Soma (+1) ou subtrai (−1) a quantidade de um produto no dia. Operações atômicas no Mongo. */
export async function changeQty(date: string, productId: string, delta: 1 | -1): Promise<RegisterDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(productId)) throw new ApiError(400, "Produto inválido.");
  const pid = new Types.ObjectId(productId);

  const register = await ensureRegister(date);
  if (register.status === "closed") throw new ApiError(409, "Este dia já foi fechado.");

  if (delta === -1) {
    await DailyRegister.updateOne(
      { date, status: "open", items: { $elemMatch: { productId: pid, qty: { $gt: 0 } } } },
      { $inc: { "items.$.qty": -1 } },
    );
  } else {
    const product = await Product.findById(pid).lean();
    if (!product || !product.active) throw new ApiError(404, "Produto não encontrado ou inativo.");
    const snapshot = {
      "items.$.name": product.name,
      "items.$.category": product.category,
      "items.$.emoji": product.emoji ?? "",
      "items.$.priceCents": product.priceCents,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const inc = await DailyRegister.updateOne(
        { date, status: "open", "items.productId": pid },
        { $inc: { "items.$.qty": 1 }, $set: snapshot },
      );
      if (inc.matchedCount > 0) break;

      const push = await DailyRegister.updateOne(
        { date, status: "open", "items.productId": { $ne: pid } },
        {
          $push: {
            items: {
              productId: pid,
              name: product.name,
              category: product.category,
              emoji: product.emoji ?? "",
              priceCents: product.priceCents,
              qty: 1,
            },
          },
        },
      );
      if (push.matchedCount > 0) break;
      // Ninguém casou: o dia foi fechado no meio ou outro aparelho inseriu o item → tenta de novo.
    }
  }

  const updated = await DailyRegister.findOne({ date }).lean<DailyRegisterRecord>();
  if (!updated) throw new ApiError(500, "Registro do dia não encontrado.");
  if (updated.status === "closed") throw new ApiError(409, "Este dia já foi fechado.");
  return toRegisterDTO(updated);
}

/** Fecha o dia: congela itens e totais e guarda a observação. */
export async function closeDay(date: string, notes: string): Promise<RegisterDTO> {
  await connectDB();
  const register = await ensureRegister(date);
  if (register.status === "closed") throw new ApiError(409, "Este dia já foi fechado.");

  const items = register.items.filter((i) => i.qty > 0);
  const totals = computeTotals(items);
  const res = await DailyRegister.updateOne(
    { date, status: "open", updatedAt: register.updatedAt },
    { $set: { status: "closed", items, ...totals, notes: notes.trim(), closedAt: new Date() } },
  );
  if (res.matchedCount === 0) {
    throw new ApiError(409, "O dia mudou enquanto você fechava. Confira a relação e tente de novo.");
  }
  return findRegister(date);
}

/** Reabre um dia fechado (somente admin). */
export async function reopenDay(date: string): Promise<RegisterDTO> {
  await connectDB();
  const res = await DailyRegister.updateOne(
    { date, status: "closed" },
    { $set: { status: "open", closedAt: null } },
  );
  if (res.matchedCount === 0) throw new ApiError(404, "Dia fechado não encontrado.");
  return findRegister(date);
}

/** Dias anteriores que ficaram abertos com algo anotado. */
export async function pendingOpenDates(before: string): Promise<string[]> {
  await connectDB();
  const docs = await DailyRegister.find(
    { status: "open", date: { $lt: before }, "items.qty": { $gt: 0 } },
    { date: 1 },
  )
    .sort({ date: -1 })
    .limit(10)
    .lean<{ date: string }[]>();
  return docs.map((d) => d.date);
}
