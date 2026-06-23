"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CurrencyInput from "@/components/CurrencyInput";
import Swal from "sweetalert2";

type PaymentState = {
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  maquininha?: number;
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
  closureId,
}: {
  defaultDate: string;
  onCreated?: () => void;
  closureId?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [observacao, setObservacao] = useState("");

  const [payment, setPayment] = useState<PaymentState>({
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
    maquininha: 0,
  });

  const total = useMemo(
    () =>
      payment.pix +
      payment.cartao_credito +
      payment.cartao_debito +
      (payment.maquininha ?? 0),
    [payment]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load existing closure when editing
  useEffect(() => {
    if (!closureId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = encodeURIComponent(String(closureId));
        const res = await fetch(`/api/closures?id=${q}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Erro ao carregar fechamento');
        const d = json.data;
        if (!cancelled && d) {
          setDate(d.date || defaultDate);
          setObservacao(d.observacao || "");
          setPayment({
            pix: Number(d.pix ?? 0),
            cartao_credito: Number(d.cartao_credito ?? 0),
            cartao_debito: Number(d.cartao_debito ?? 0),
            maquininha: Number(d.maquininha ?? 0),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro inesperado';
        setError(message);
      }
    })();
    return () => { cancelled = true; };
  }, [closureId, defaultDate]);

  const update = (key: keyof PaymentState, value: string) => {
    // Mantém o valor como número interno, mas garante que não vai “re-escrever” com zeros à esquerda.
    // (Como o input recebe `value={number}`, o React tende a normalizar a representação.)
    setPayment((p) => ({ ...p, [key]: toNumber(value) }));
  };

  const router = useRouter();

  const submit = async (e?: React.FormEvent, redirectAfterSave = false) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setError(null);

    if (!date) {
      setError("Informe a data.");
      return;
    }

    setLoading(true);
    try {
      const method = closureId ? "PATCH" : "POST";
      const payload: any = {
        date,
        pix: payment.pix,
        cartao_credito: payment.cartao_credito,
        cartao_debito: payment.cartao_debito,
        maquininha: payment.maquininha ?? 0,
        observacao,
      };
      if (closureId) payload.id = closureId;

      const res = await fetch("/api/closures", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar fechamento.");
      }

      const successTitle = closureId ? "Fechamento atualizado!" : "Fechamento salvo!";

      const after = () => {
        if (redirectAfterSave) {
          router.push("/fechamentos");
        } else {
          onCreated?.();
        }
      };

      Swal.fire({ icon: "success", title: successTitle, text: "Toque em OK para continuar.", confirmButtonText: "OK" }).then(after);

      if (!closureId) {
        setObservacao("");
        setPayment({ pix: 0, cartao_credito: 0, cartao_debito: 0, maquininha: 0 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => submit(e, true)} className="space-y-4">
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Pix</label>
            <CurrencyInput value={payment.pix} onChange={(n) => update("pix", String(n))} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cartão Crédito</label>
            <CurrencyInput value={payment.cartao_credito} onChange={(n) => update("cartao_credito", String(n))} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cartão Débito</label>
            <CurrencyInput value={payment.cartao_debito} onChange={(n) => update("cartao_debito", String(n))} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Valor Maquininha</label>
            <CurrencyInput value={payment.maquininha ?? 0} onChange={(n) => update("maquininha", String(n))} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
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
        {loading ? "Salvando..." : "Salvar e voltar"}
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

