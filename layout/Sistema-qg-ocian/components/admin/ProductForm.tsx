"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { centsToInput, parseBRL } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

export type ProductFormValues = Omit<ProductDTO, "id">;

const EMOJIS = ["☕", "🥤", "🧃", "🍵", "🥛", "🥐", "🥪", "🍔", "🌭", "🍕", "🥟", "🧀", "🍰", "🍩", "🍪", "🍫", "🍦", "🍞", "🥚", "💧"];

type Props = {
  open: boolean;
  initial: ProductDTO | null;
  categories: string[];
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
};

export function ProductForm({ open, initial, categories, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [emoji, setEmoji] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "");
    setPrice(initial ? centsToInput(initial.priceCents) : "");
    setEmoji(initial?.emoji ?? "");
    setSortOrder(String(initial?.sortOrder ?? 0));
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = parseBRL(price);
    if (priceCents === null) return setError("Preço inválido. Ex.: 5,50");
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        category: category.trim(),
        priceCents,
        emoji: emoji.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

  return (
    <Modal
      open={open}
      title={initial ? "Editar produto" : "Novo produto"}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-line py-3 font-semibold hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="flex-[2] rounded-2xl bg-brand py-3 font-bold text-brand-ink disabled:opacity-60"
          >
            {saving ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar produto"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nome</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Ex.: Café expresso" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Categoria</span>
            <input
              className={input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="categories"
              maxLength={40}
              required
              placeholder="Ex.: Bebidas"
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Preço (R$)</span>
            <input
              className={`${input} tabular-nums`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              required
              placeholder="0,00"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Ícone (opcional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(emoji === em ? "" : em)}
                aria-pressed={emoji === em}
                aria-label={`Ícone ${em}`}
                className={`grid h-10 w-10 place-items-center rounded-lg border text-xl ${
                  emoji === em ? "border-brand bg-brand-soft" : "border-line bg-bg hover:bg-surface-2"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Ordem na lista</span>
            <input
              className={input}
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-3 self-end rounded-xl border border-line bg-bg px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            <span className="text-sm font-semibold">Ativo na Saída</span>
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
