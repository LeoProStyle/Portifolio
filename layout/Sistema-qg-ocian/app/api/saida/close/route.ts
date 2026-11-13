import { ApiError, handler, json, requireSession } from "@/lib/api";
import { todayKey } from "@/lib/date";
import { closeDay } from "@/lib/register";
import { CloseDay } from "@/lib/validation";

/** Fecha o dia com observação. */
export const POST = handler(async (req: Request) => {
  await requireSession();
  const { date, notes } = CloseDay.parse(await req.json());
  if (date > todayKey()) throw new ApiError(400, "Não dá para fechar um dia futuro.");
  return json({ register: await closeDay(date, notes) });
});
