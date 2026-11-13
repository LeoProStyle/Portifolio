import { Types } from "mongoose";
import { ApiError, handler, json, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { duplicateInvoiceError, saveInvoiceData } from "@/lib/invoices";
import { toInvoiceDTO } from "@/lib/serializers";
import { InvoiceInput } from "@/lib/validation";
import { Invoice, type InvoiceRecord } from "@/models/Invoice";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Cupom inválido.");
  return new Types.ObjectId(id);
}

/** PUT — substitui o cupom inteiro. */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  const input = InvoiceInput.parse(await req.json());
  await connectDB();
  const current = await Invoice.findById(id).select({ cNF: 1 }).lean<Pick<InvoiceRecord, "cNF">>();
  if (!current) throw new ApiError(404, "Cupom não encontrado.");
  try {
    const doc = await Invoice.findByIdAndUpdate(id, { $set: saveInvoiceData(input, current.cNF) }, { returnDocument: "after", runValidators: true })
      .lean<InvoiceRecord>();
    if (!doc) throw new ApiError(404, "Cupom não encontrado.");
    return json({ invoice: toInvoiceDTO(doc) });
  } catch (err) {
    throw duplicateInvoiceError(err);
  }
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const id = await parseId(ctx);
  await connectDB();
  const res = await Invoice.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError(404, "Cupom não encontrado.");
  return json({ deleted: true });
});
