import { handler, json, requireSession } from "@/lib/api";
import { cancelSale } from "@/lib/sales";
import { CancelSaleInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Cancela a venda (e a NFC-e no provedor, se autorizada). */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const role = await requireSession();
  const { id } = await ctx.params;
  const data = CancelSaleInput.parse(await req.json());
  return json({ sale: await cancelSale(id, data, role) });
});
