/**
 * Escolhe o provedor fiscal pelas variáveis de ambiente.
 * FISCAL_PROVIDER vazio (ou focusnfe sem token) = cupom fiscal desligado.
 */
import type { FiscalEnv } from "@/lib/types";
import { createFocusProvider } from "./focusnfe";
import { createMockProvider } from "./mock";
import type { FiscalProvider } from "./types";

export type { FiscalProvider, FiscalResult } from "./types";

// o mock guarda as notas em memória: uma instância por processo
const g = globalThis as unknown as { __qgMockFiscal?: FiscalProvider };

export function getFiscalProvider(env: Record<string, string | undefined> = process.env, fetchImpl?: typeof fetch): FiscalProvider | null {
  const name = (env.FISCAL_PROVIDER ?? "").trim().toLowerCase();
  if (name === "mock") return (g.__qgMockFiscal ??= createMockProvider());
  if (name === "focusnfe") {
    const token = (env.FOCUS_NFE_TOKEN ?? "").trim();
    if (!token) return null;
    const environment: FiscalEnv = env.FOCUS_NFE_ENV === "producao" ? "producao" : "homologacao";
    return createFocusProvider({ token, environment, fetchImpl });
  }
  return null;
}
