import { ApiError, handler, json, requireSession } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { isDateKey, todayKey } from "@/lib/date";
import { findRegister, pendingOpenDates } from "@/lib/register";
import { toProductDTO } from "@/lib/serializers";
import type { SaidaResponse } from "@/lib/types";
import { Product, type ProductRecord } from "@/models/Product";

export const dynamic = "force-dynamic";

/** Dados da aba Saída: dia (hoje por padrão), produtos ativos e dias pendentes de fechamento. */
export const GET = handler(async (req: Request) => {
  await requireSession();
  const today = todayKey();
  const param = new URL(req.url).searchParams.get("date");
  if (param && (!isDateKey(param) || param > today)) throw new ApiError(400, "Data inválida.");
  const date = param ?? today;

  await connectDB();
  const [register, products, pendingDates] = await Promise.all([
    findRegister(date),
    Product.find({ active: true })
      .collation({ locale: "pt" })
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .lean<ProductRecord[]>(),
    pendingOpenDates(today),
  ]);

  const body: SaidaResponse = { today, register, products: products.map(toProductDTO), pendingDates };
  return json(body);
});
