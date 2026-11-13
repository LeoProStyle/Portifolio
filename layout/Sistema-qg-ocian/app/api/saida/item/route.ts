import { ApiError, handler, json, requireSession } from "@/lib/api";
import { todayKey } from "@/lib/date";
import { changeQty } from "@/lib/register";
import { QtyChange } from "@/lib/validation";

/** + / − de um produto no dia. */
export const POST = handler(async (req: Request) => {
  await requireSession();
  const { productId, delta, date } = QtyChange.parse(await req.json());
  const today = todayKey();
  const day = date ?? today;
  if (day > today) throw new ApiError(400, "Não dá para anotar em dias futuros.");
  return json({ register: await changeQty(day, productId, delta) });
});
