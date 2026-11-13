/** Dinheiro é sempre guardado em centavos (inteiro) para evitar erros de arredondamento. */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return BRL.format((cents || 0) / 100);
}

/**
 * Converte texto digitado ("12,50", "R$ 1.234,5", "7") em centavos.
 * Retorna null se não for um valor válido.
 */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Centavos para texto editável ("12,50"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
