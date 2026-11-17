import type { FiscalEnv, FiscalSettingsDTO, FiscalStatus, SaleDTO } from "@/lib/types";

/** Resultado de uma emissão/consulta no provedor, já no vocabulário do sistema. */
export interface FiscalResult {
  status: Exclude<FiscalStatus, "cancelada">;
  accessKey: string;
  number: string;
  series: string;
  protocol: string;
  qrCodeUrl: string;
  consultUrl: string;
  xmlUrl: string;
  danfeUrl: string;
  message: string;
}

/**
 * Quem conversa com a SEFAZ. O certificado A1 e o CSC ficam no provedor;
 * o sistema só conhece o token (variável de ambiente).
 */
export interface FiscalProvider {
  name: string;
  environment: FiscalEnv;
  emit(ref: string, sale: SaleDTO, settings: FiscalSettingsDTO): Promise<FiscalResult>;
  /** null = o provedor não conhece essa ref (nunca foi emitida). */
  consult(ref: string): Promise<FiscalResult | null>;
  cancel(ref: string, reason: string): Promise<{ ok: boolean; message: string }>;
}

export function emptyResult(status: FiscalResult["status"], message = ""): FiscalResult {
  return { status, accessKey: "", number: "", series: "", protocol: "", qrCodeUrl: "", consultUrl: "", xmlUrl: "", danfeUrl: "", message };
}
