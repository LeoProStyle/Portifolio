import { Types } from "mongoose";
import { ApiError, handler, json, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { todayKey } from "@/lib/date";
import { toExpenseDTO } from "@/lib/serializers";
import { ExpenseInput } from "@/lib/validation";
import { Expense, type ExpenseRecord } from "@/models/Expense";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Lançamento inválido.");
  return new Types.ObjectId(id);
}

/** PUT — substitui o lançamento inteiro (o formulário sempre manda todos os campos). */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  const data = ExpenseInput.parse(await req.json());
  if (data.date > todayKey()) throw new ApiError(400, "A data não pode ser no futuro.");
  await connectDB();
  const doc = await Expense.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true })
    .lean<ExpenseRecord>();
  if (!doc) throw new ApiError(404, "Lançamento não encontrado.");
  return json({ expense: toExpenseDTO(doc) });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  await connectDB();
  const res = await Expense.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError(404, "Lançamento não encontrado.");
  return json({ deleted: true });
});
