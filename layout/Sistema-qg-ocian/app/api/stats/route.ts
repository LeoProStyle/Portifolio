import { ApiError, handler, json, requireAdmin } from "@/lib/api";
import { addDays, dateRange, isDateKey, todayKey } from "@/lib/date";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD (padrão: últimos 7 dias) */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const to = sp.get("to") ?? todayKey();
  const from = sp.get("from") ?? addDays(to, -6);
  if (!isDateKey(from) || !isDateKey(to) || from > to) throw new ApiError(400, "Período inválido.");
  if (dateRange(from, to).length > 366) throw new ApiError(400, "Período máximo: 1 ano.");
  return json(await getStats(from, to));
});
