import { ApiError, handler, json, requireSession } from "@/lib/api";
import { isDateKey, todayKey } from "@/lib/date";
import { createSale, listSales } from "@/lib/sales";
import { SaleInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Vendas de um dia (hoje por padrão) com os totais por forma de pagamento. */
export const GET = handler(async (req: Request) => {
  await requireSession();
  const param = new URL(req.url).searchParams.get("date");
  if (param && (!isDateKey(param) || param > todayKey())) throw new ApiError(400, "Data inválida.");
  return json(await listSales(param ?? todayKey()));
});

/** Finaliza uma venda (preços sempre do cadastro; mesmo clientRef devolve a mesma venda). */
export const POST = handler(async (req: Request) => {
  const role = await requireSession();
  const data = SaleInput.parse(await req.json());
  return json({ sale: await createSale(data, role) });
});
