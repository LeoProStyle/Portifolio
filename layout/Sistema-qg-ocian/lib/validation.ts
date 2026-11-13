import { z } from "zod";
import { isDateKey } from "./date";

export const ProductInput = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60, "Nome muito longo"),
  category: z.string().trim().min(1, "Informe a categoria").max(40, "Categoria muito longa"),
  priceCents: z.number().int("Preço inválido").min(0, "Preço não pode ser negativo").max(10_000_00, "Preço muito alto"),
  emoji: z.string().trim().max(16).optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export const ProductPatch = ProductInput.partial();

export const DateKey = z.string().refine(isDateKey, "Data inválida");

export const QtyChange = z.object({
  productId: z.string().min(1),
  delta: z.union([z.literal(1), z.literal(-1)]),
  date: DateKey.optional(),
});

export const CloseDay = z.object({
  date: DateKey,
  notes: z.string().max(1000, "Observação muito longa").optional().default(""),
});
