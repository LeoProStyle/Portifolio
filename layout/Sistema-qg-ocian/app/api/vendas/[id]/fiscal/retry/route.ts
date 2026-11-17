import { handler, json, requireSession } from "@/lib/api";
import { retryFiscal } from "@/lib/sales";

type Ctx = { params: Promise<{ id: string }> };

/** Tenta de novo a NFC-e (consulta o provedor antes para não emitir em dobro). */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  return json({ sale: await retryFiscal(id) });
});
