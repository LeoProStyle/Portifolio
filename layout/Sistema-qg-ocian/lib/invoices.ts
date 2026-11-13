/** Regras de gravação dos cupons (servidor). */
import type { z } from "zod";
import { ApiError } from "./api";
import { itemTotalCents, parseAccessKey } from "./fiscal";
import type { InvoiceInput } from "./validation";

type InvoiceData = z.output<typeof InvoiceInput>;

/**
 * Calcula os valores (nunca confia no total vindo da tela) e define o cNF:
 * o da chave de acesso, se informada; senão mantém o atual ou usa `fallbackCNF`.
 */
export function saveInvoiceData(data: InvoiceData, fallbackCNF: string) {
  const items = data.items.map((it) => ({ ...it, qty: Math.round(it.qty * 10_000) / 10_000, totalCents: itemTotalCents(it) }));
  const totalCents = items.reduce((acc, it) => acc + it.totalCents, 0);
  const cNF = (data.accessKey && parseAccessKey(data.accessKey)?.cNF) || fallbackCNF;
  return { ...data, items, totalCents, cNF };
}

/** Converte o erro de índice único do Mongo numa mensagem clara. */
export function duplicateInvoiceError(err: unknown): unknown {
  if (typeof err === "object" && err && "code" in err && (err as { code: unknown }).code === 11000) {
    return new ApiError(409, "Esse cupom fiscal já foi cadastrado (mesmo emitente, modelo, série e número).");
  }
  return err;
}
