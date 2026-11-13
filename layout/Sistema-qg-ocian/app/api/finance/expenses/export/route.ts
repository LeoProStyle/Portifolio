import { fileResponse, handler, queryOf, requireAdmin } from "@/lib/api";
import { expensesSheet } from "@/lib/finance-data";
import { XLSX_MIME } from "@/lib/xlsx";
import { ExpenseFilter } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM&type= — planilha Excel dos lançamentos, com TOTAL e resumo por tipo. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const { month, type } = ExpenseFilter.parse(queryOf(req));
  const buf = await expensesSheet(month, type);
  return fileResponse(new Uint8Array(buf), `despesas-${type ? `${type}-` : ""}${month}.xlsx`, XLSX_MIME);
});
