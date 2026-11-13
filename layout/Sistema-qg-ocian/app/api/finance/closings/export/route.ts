import { fileResponse, handler, requireAdmin } from "@/lib/api";
import { currentMonthKey } from "@/lib/date";
import { closingsSheet } from "@/lib/finance-data";
import { MonthKey } from "@/lib/validation";
import { XLSX_MIME } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM — planilha Excel dos fechamentos do mês, com linha de TOTAL. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const month = MonthKey.parse(new URL(req.url).searchParams.get("month") ?? currentMonthKey());
  const buf = await closingsSheet(month);
  return fileResponse(new Uint8Array(buf), `fechamentos-${month}.xlsx`, XLSX_MIME);
});
