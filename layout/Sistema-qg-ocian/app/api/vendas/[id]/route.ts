import { handler, json, requireSession } from "@/lib/api";
import { getSaleReceipt } from "@/lib/sales";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Venda + dados da empresa (comprovante). */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  return json(await getSaleReceipt(id));
});
