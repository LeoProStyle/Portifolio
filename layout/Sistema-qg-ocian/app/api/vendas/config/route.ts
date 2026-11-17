import { handler, json, requireAdmin } from "@/lib/api";
import { getFiscalConfig, saveFiscalConfig } from "@/lib/sales";
import { FiscalConfigInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Configuração fiscal (empresa, padrões e NCM dos produtos) — só do dono. */
export const GET = handler(async () => {
  await requireAdmin();
  return json(await getFiscalConfig());
});

export const PUT = handler(async (req: Request) => {
  await requireAdmin();
  const data = FiscalConfigInput.parse(await req.json());
  return json(await saveFiscalConfig(data));
});
