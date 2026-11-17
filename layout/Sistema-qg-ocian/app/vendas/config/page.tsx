import type { Metadata } from "next";
import { FiscalConfig } from "@/components/vendas/FiscalConfig";

export const metadata: Metadata = { title: "Configuração fiscal — QG Ocian" };

export default function FiscalConfigPage() {
  return <FiscalConfig />;
}
