"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";

type PaymentState = {
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
};

const toNumber = (v: string) => {
  // Aceita entrada como "0500", "500", "1.200,50" (pt-BR) e "1200.50".
  // Remove tudo que não for dígito, vírgula ou ponto.
  const cleaned = v
    .replace(/[^0-9.,-]/g, "")
    .trim();

  if (!cleaned) return 0;

  // Se tiver vírgula, tratamos como decimal pt-BR.
  if (cleaned.includes(",")) {
    const normalized = cleaned
      .replace(/\./g, "") // remove separador de milhar
      .replace(",", "."); // vírgula decimal -> ponto
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClosureForm({
  defaultDate,
  onCreated,
}: {
  defaultDate: string;
  onCreated?: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [observacao, setObservacao] = useState("");

  const [payment, setPayment] = useState<PaymentState>({
    dinheiro: 0,
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
  });

  const total = useMemo(
    () =>
      payment.dinheiro +
      payment.pix +
      payment.cartao_credito +
      payment.cartao_debito,
    [payment]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof PaymentState, value: string) => {
    // Mantém o valor como número interno, mas garante que não vai “re-escrever” com zeros à esquerda.
    // (Como o input recebe `value={number}`, o React tende a normalizar a representação.)
    setPayment((p) => ({ ...p, [key]: toNumber(value) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("Informe a data.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/closures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          dinheiro: payment.dinheiro,
          pix: payment.pix,
          cartao_credito: payment.cartao_credito,
          cartao_debito: payment.cartao_debito,
          observacao,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar fechamento.");
      }

      Swal.fire({
        icon: "success",
        title: "Fechamento salvo!",
        text: "Toque em OK para continuar.",
        confirmButtonText: "OK",
        timer: undefined,
      }).then(() => onCreated?.());

      setObservacao("");
      setPayment({
        dinheiro: 0,
        pix: 0,
        cartao_credito: 0,
        cartao_debito: 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
          <label className="text-sm font-medium">Observação</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="text-sm font-semibold">Entradas</div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AmountInput
            label="Dinheiro"
            value={payment.dinheiro}
            onChange={(v) => update("dinheiro", v)}
          />
          <AmountInput
            label="Pix"
            value={payment.pix}
            onChange={(v) => update("pix", v)}
          />
          <AmountInput
            label="Cartão Crédito"
            value={payment.cartao_credito}
            onChange={(v) => update("cartao_credito", v)}
          />
          <AmountInput
            label="Cartão Débito"
            value={payment.cartao_debito}
            onChange={(v) => update("cartao_debito", v)}
          />
        </div>

        <div className="mt-4 rounded-2xl border bg-white dark:bg-zinc-900 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Valor</label>
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Prévia: <b>{formatBRL(total)}</b>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {loading ? "Salvando..." : "Salvar fechamento"}
      </button>
    </form>
  );
}

function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        inputMode="decimal"
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onInput={(e) => {
          const el = e.currentTarget;
          const n = toNumber(el.value);
          // Normaliza em tempo real para remover zeros à esquerda
          if (el.value !== String(n)) el.value = String(n);
          onChange(el.value);
        }}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
    </div>
  );
}

