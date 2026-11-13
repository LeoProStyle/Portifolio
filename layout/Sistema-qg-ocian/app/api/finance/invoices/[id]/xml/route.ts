import { Types } from "mongoose";
import { ApiError, fileResponse, handler, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { buildInvoiceXml, invoiceFileName } from "@/lib/fiscal";
import { toInvoiceDTO } from "@/lib/serializers";
import { Invoice, type InvoiceRecord } from "@/models/Invoice";

type Ctx = { params: Promise<{ id: string }> };

/** GET — baixa o XML do cupom (layout NF-e 4.00, igual ao docs/ref). */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Cupom inválido.");
  await connectDB();
  const doc = await Invoice.findById(id).lean<InvoiceRecord>();
  if (!doc) throw new ApiError(404, "Cupom não encontrado.");
  const inv = toInvoiceDTO(doc);
  return fileResponse(buildInvoiceXml(inv), invoiceFileName(inv), "application/xml; charset=utf-8");
});
