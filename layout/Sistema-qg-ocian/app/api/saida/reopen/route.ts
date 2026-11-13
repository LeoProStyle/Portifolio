import { z } from "zod";
import { handler, json, requireAdmin } from "@/lib/api";
import { reopenDay } from "@/lib/register";
import { DateKey } from "@/lib/validation";

/** Reabre um dia fechado (somente admin). */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const { date } = z.object({ date: DateKey }).parse(await req.json());
  return json({ register: await reopenDay(date) });
});
