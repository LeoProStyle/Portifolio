"use client";

import { useMemo, useState } from "react";

type ExpenseCategory =
  | "Mercadorias"
  | "Bebidas"
  | "Energia"
  | "Água"
  | "Internet"
  | "Aluguel"
  | "Funcionários"
  | "Outros"
  | "Relatórios"
  | "Diário";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ExpenseForm({
  defaultDate,
  onCreated,
}: {
  defaultDate: string;
  onCreated?: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState<ExpenseCategory>("Mercadorias");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !date || !category || loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("Informe a data.");
      return;
    }

    if (!category) {
      setError("Informe a categoria.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          category,
          description,
          amount: Number(amount),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar despesa.");
      }

      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
    } finally {

      setLoading(false);
    }
  };

  const amountPreview = useMemo(() => formatBRL(amount || 0), [amount]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {(
              [
                "Mercadorias",
                "Bebidas",
                "Energia",
                "Água",
                "Internet",
                "Aluguel",
                "Funcionários",
                "Outros",
                "Relatórios",
                "Diário",
              ] as ExpenseCategory[]
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descrição</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Valor</label>
          <input
            inputMode="decimal"
            type="number"
            step="0.01"
            value={amount}
            onInput={(e) => {
              const el = e.currentTarget;
              const n = toNumber(el.value);
              // Normaliza em tempo real para remover zeros à esquerda
              if (el.value !== String(n)) el.value = String(n);
              setAmount(n);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Prévia: <b>{amountPreview}</b>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {loading ? "Salvando..." : "Salvar despesa"}
      </button>
    </form>
  );
}

