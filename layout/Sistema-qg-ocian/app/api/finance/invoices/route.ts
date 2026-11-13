import { handler, json, queryOf, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { getInvoicesMonth } from "@/lib/finance-data";
import { randomCNF } from "@/lib/fiscal";
import { duplicateInvoiceError, saveInvoiceData } from "@/lib/invoices";
import { toInvoiceDTO } from "@/lib/serializers";
import { InvoiceFilter, InvoiceInput } from "@/lib/validation";
import { Invoice } from "@/models/Invoice";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM&kind= — cupons do mês + emitentes já usados (para o formulário). */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const { month, kind } = InvoiceFilter.parse(queryOf(req));
  return json(await getInvoicesMonth(month, kind));
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const data = saveInvoiceData(InvoiceInput.parse(await req.json()), randomCNF());
  await connectDB();
  try {
    const doc = await Invoice.create(data);
    return json({ invoice: toInvoiceDTO(doc.toObject()) }, 201);
  } catch (err) {
    throw duplicateInvoiceError(err);
  }
});
