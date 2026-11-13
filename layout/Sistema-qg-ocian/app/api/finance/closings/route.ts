import { ApiError, handler, json, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { currentMonthKey, todayKey } from "@/lib/date";
import { closingTotal } from "@/lib/finance";
import { getClosingsMonth } from "@/lib/finance-data";
import { toClosingDTO } from "@/lib/serializers";
import { ClosingInput, DateKey, MonthKey } from "@/lib/validation";
import { CardClosing, type CardClosingRecord } from "@/models/CardClosing";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM — dias do mês com o fechamento da maquininha e o total anotado na Saída. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const month = MonthKey.parse(new URL(req.url).searchParams.get("month") ?? currentMonthKey());
  return json(await getClosingsMonth(month));
});

/** PUT — grava (cria ou substitui) o fechamento de um dia. */
export const PUT = handler(async (req: Request) => {
  await requireAdmin();
  const data = ClosingInput.parse(await req.json());
  if (data.date > todayKey()) throw new ApiError(400, "Não dá para fechar um dia que ainda não chegou.");
  const totalCents = closingTotal(data);
  if (data.feesCents > totalCents) throw new ApiError(400, "As taxas não podem ser maiores que o total.");
  await connectDB();
  const doc = await CardClosing.findOneAndUpdate(
    { date: data.date },
    { $set: { ...data, totalCents } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean<CardClosingRecord>();
  return json({ closing: toClosingDTO(doc!) });
});

/** DELETE ?date=YYYY-MM-DD — apaga o fechamento do dia (para lançar de novo). */
export const DELETE = handler(async (req: Request) => {
  await requireAdmin();
  const date = DateKey.parse(new URL(req.url).searchParams.get("date"));
  await connectDB();
  const res = await CardClosing.deleteOne({ date });
  if (res.deletedCount === 0) throw new ApiError(404, "Fechamento não encontrado.");
  return json({ deleted: true });
});
