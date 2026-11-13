import { Types } from "mongoose";
import { ApiError, handler, json, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { toProductDTO } from "@/lib/serializers";
import { ProductPatch } from "@/lib/validation";
import { Product, type ProductRecord } from "@/models/Product";
import { DailyRegister } from "@/models/DailyRegister";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Produto inválido.");
  return new Types.ObjectId(id);
}

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  const data = ProductPatch.parse(await req.json());
  await connectDB();
  const doc = await Product.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true })
    .lean<ProductRecord>();
  if (!doc) throw new ApiError(404, "Produto não encontrado.");
  return json({ product: toProductDTO(doc) });
});

/**
 * Remove o produto. Se ele já apareceu em alguma saída, só desativa
 * (o histórico continua íntegro e ele some da aba Saída).
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  await connectDB();
  const used = await DailyRegister.exists({ items: { $elemMatch: { productId: id, qty: { $gt: 0 } } } });
  if (used) {
    const doc = await Product.findByIdAndUpdate(id, { $set: { active: false } }, { returnDocument: "after" })
      .lean<ProductRecord>();
    if (!doc) throw new ApiError(404, "Produto não encontrado.");
    return json({ deleted: false, deactivated: true, product: toProductDTO(doc) });
  }
  const res = await Product.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError(404, "Produto não encontrado.");
  // limpa itens zerados que possam ter ficado em dias abertos
  await DailyRegister.updateMany({ status: "open" }, { $pull: { items: { productId: id, qty: 0 } } });
  return json({ deleted: true, deactivated: false });
});
