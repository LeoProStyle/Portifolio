import { handler, json, requireSession } from "@/lib/api";
import { getCatalog } from "@/lib/sales";

export const dynamic = "force-dynamic";

/** Produtos ativos + se o cupom fiscal está liberado. */
export const GET = handler(async () => {
  const role = await requireSession();
  return json(await getCatalog(role));
});
