"use client";

import React, { useMemo, useState } from "react";
import CurrencyInput from "@/components/CurrencyInput";
import { useRouter } from "next/navigation";
import type { ExpenseCategory } from "@/types";
import Swal from "sweetalert2";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ExpenseForm({
  defaultDate,
  onCreated,
  expenseId,
}: {
  defaultDate: string;
  onCreated?: () => void;
  expenseId?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState<ExpenseCategory>("Mercadoria");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [supplier, setSupplier] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [hasFiscalDocument, setHasFiscalDocument] = useState(false);
  const [documentNumber, setDocumentNumber] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const disabled = !date || !category || !description || typeof amount !== "number" || loading;

  // load existing when editing
  useEffectOnce(() => {
    if (!expenseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/expenses?id=${expenseId}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar");
        const d = json.data;
        if (!cancelled && d) {
          setDate(d.date || defaultDate);
          setCategory(d.category || "Mercadoria");
          setDescription(d.description || "");
          setAmount(Number(d.amount ?? 0));
          setSupplier(d.supplier || "");
          setPaymentMethod(d.paymentMethod || "");
          setHasFiscalDocument(!!d.hasFiscalDocument);
          setDocumentNumber(d.documentNumber || "");
          setNote(d.note || "");
          setActive(d.active !== false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) return setError("Informe a data.");
    if (!category) return setError("Informe a categoria.");
    if (!description) return setError("Informe a descrição.");
    if (!amount || Number.isNaN(amount)) return setError("Informe o valor.");

    setLoading(true);
    // show loading modal
    Swal.fire({
      title: "Salvando despesa...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const payload = {
        date,
        category,
        description,
        amount: Number(amount),
        supplier,
        paymentMethod,
        hasFiscalDocument,
        documentNumber,
        note,
        active,
      } as any;

      const res = await fetch("/api/expenses", {
        method: expenseId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(expenseId ? { id: expenseId, ...payload } : payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar despesa.");
      }

      Swal.close();
      Swal.fire({ icon: "success", title: "Despesa salva!", confirmButtonText: "OK" }).then(() => {
        onCreated?.();
        router.push("/despesas");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      Swal.close();
      Swal.fire({ icon: "error", title: "Erro", text: message });
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
                "Mercadoria",
                "Bebidas",
                "Embalagens",
                "Gás",
                "Energia",
                "Água",
                "Internet",
                "Aluguel",
                "Marketing",
                "Limpeza",
                "Manutenção",
                "Impostos",
                "Outros",
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
          placeholder="Descrição da despesa"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fornecedor</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Forma de Pagamento</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <option value="">--</option>
            <option>Dinheiro</option>
            <option>PIX</option>
            <option>Cartão Crédito</option>
            <option>Cartão Débito</option>
            <option>Transferência</option>
            <option>Outro</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Valor</label>
            <CurrencyInput value={amount} onChange={(n) => setAmount(n)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Prévia: <b>{amountPreview}</b></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <input id="hasFiscal" type="checkbox" checked={hasFiscalDocument} onChange={(e) => setHasFiscalDocument(e.target.checked)} />
          <label htmlFor="hasFiscal" className="text-sm">Possui documento fiscal</label>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Número do Documento</label>
          <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} disabled={!hasFiscalDocument} placeholder="Opcional" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observação</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
      </div>

      <div className="flex items-center gap-3">
        <input id="active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <label htmlFor="active" className="text-sm">Ativo</label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={disabled} className="w-full rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black">{loading ? "Salvando..." : expenseId ? "Atualizar despesa" : "Salvar despesa"}</button>
    </form>
  );
}

// small helper to run effect once
function useEffectOnce(cb: () => void | (() => void)) {
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    return cb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

