import { ApiError, handler, json, queryOf, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { todayKey } from "@/lib/date";
import { getExpensesMonth } from "@/lib/finance-data";
import { toExpenseDTO } from "@/lib/serializers";
import { ExpenseFilter, ExpenseInput } from "@/lib/validation";
import { Expense } from "@/models/Expense";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM&type= — lançamentos do mês. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const { month, type } = ExpenseFilter.parse(queryOf(req));
  return json(await getExpensesMonth(month, type));
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const data = ExpenseInput.parse(await req.json());
  if (data.date > todayKey()) throw new ApiError(400, "A data não pode ser no futuro.");
  await connectDB();
  const doc = await Expense.create(data);
  return json({ expense: toExpenseDTO(doc.toObject()) }, 201);
});
