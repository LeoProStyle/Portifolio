"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Printer, X } from "lucide-react";
import { post } from "@/lib/client";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { CASH, SALE_METHODS, type SaleMethod } from "@/lib/sales-rules";
import type { SaleDTO, SaleKind } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { FISCAL_LABELS, METHOD_LABELS, receiptHref, saleNumber } from "./labels";

type PayLine = { method: SaleMethod; amount: string };

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base tabular-nums outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

/** Notas comuns para o "valor recebido" (troco rápido). */
function cashSuggestions(cash: number): number[] {
  const out = new Set<number>([cash]);
  for (const note of [500, 1000, 2000, 5000, 10000, 20000]) {
    const v = Math.ceil(cash / note) * note;
    if (v > cash) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

export function PaymentDialog(props: {
  open: boolean;
  totalCents: number;
  kind: SaleKind;
  items: { productId: string; qty: number }[];
  customerDoc: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { open, totalCents, kind } = props;
  const [lines, setLines] = useState<PayLine[]>([]);
  const [received, setReceived] = useState("");
  const [clientRef, setClientRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SaleDTO | null>(null);

  // nova referência a cada abertura: repetir "Finalizar" no mesmo pedido nunca duplica a venda
  useEffect(() => {
    if (!open) return;
    setLines([{ method: "17", amount: centsToInput(totalCents) }]);
    setReceived("");
    setDone(null);
    setClientRef(crypto.randomUUID());
  }, [open, totalCents]);

  const amounts = lines.map((l) => parseBRL(l.amount) ?? 0);
  const paid = amounts.reduce((a, b) => a + b, 0);
  const cash = lines.reduce((acc, l, i) => (l.method === CASH ? acc + amounts[i] : acc), 0);
  const receivedCents = received.trim() ? parseBRL(received) : null;
  const changeCents = cash > 0 && receivedCents !== null ? receivedCents - cash : 0;
  const remaining = totalCents - paid;

  const problem =
    amounts.some((a) => a <= 0)
      ? "Informe o valor de cada forma de pagamento"
      : remaining !== 0
        ? remaining > 0
          ? `Faltam ${formatBRL(remaining)}`
          : `Passou ${formatBRL(-remaining)} do total`
        : cash > 0 && receivedCents !== null && receivedCents < cash
          ? "Valor recebido menor que o valor em dinheiro"
          : null;

  const setLine = (i: number, patch: Partial<PayLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  /** Toque numa forma: com uma linha só, troca a forma mantendo o total. */
  const pickSingle = (method: SaleMethod) => setLines([{ method, amount: centsToInput(totalCents) }]);

  const finish = async () => {
    if (problem || busy) return;
    setBusy(true);
    try {
      const res = await post<{ sale: SaleDTO }>("/api/vendas", {
        clientRef,
        kind,
        items: props.items,
        payments: lines.map((l, i) => ({ method: l.method, amountCents: amounts[i] })),
        ...(cash > 0 ? { receivedCents: receivedCents ?? cash } : {}),
        ...(kind === "fiscal" && props.customerDoc.trim() ? { customerDoc: props.customerDoc } : {}),
      });
      setDone(res.sale);
      const f = res.sale.fiscal;
      if (f && f.status !== "autorizada") toast(`${FISCAL_LABELS[f.status]}: ${f.message || "veja em Vendas do dia"}`, "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível finalizar a venda.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const f = done.fiscal;
    return (
      <Modal open={open} title="Venda concluída" onClose={props.onDone}>
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto text-success" size={44} aria-hidden />
          <div>
            <p className="text-sm text-muted">Venda nº {saleNumber(done.number)}</p>
            <p className="text-3xl font-extrabold tabular-nums">{formatBRL(done.totalCents)}</p>
          </div>
          {done.changeCents > 0 && (
            <div className="rounded-2xl bg-brand-soft px-4 py-3">
              <p className="text-sm font-semibold text-brand">Troco</p>
              <p className="text-3xl font-extrabold tabular-nums text-brand">{formatBRL(done.changeCents)}</p>
            </div>
          )}
          {f && (
            <p className={`text-sm font-semibold ${f.status === "autorizada" ? "text-success" : "text-danger"}`} role="status">
              {FISCAL_LABELS[f.status]}
              {f.status !== "autorizada" && f.message ? ` — ${f.message}` : ""}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={receiptHref(done)}
              target="_blank"
              rel="noopener"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 font-bold hover:bg-surface-2"
            >
              <Printer size={18} aria-hidden /> {f?.status === "autorizada" ? "Abrir DANFE NFC-e" : "Imprimir comprovante"}
            </a>
            <button type="button" data-autofocus onClick={props.onDone} className="flex-1 rounded-2xl bg-ink px-4 py-3 font-bold text-bg">
              Nova venda
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={`Pagamento · ${formatBRL(totalCents)}`}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" onClick={props.onClose} className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-surface-2">
            Voltar
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!!problem || busy}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 font-bold text-brand-ink disabled:opacity-40"
          >
            {busy ? "Finalizando…" : kind === "fiscal" ? "Finalizar e emitir NFC-e" : "Finalizar venda"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Cupom <strong className="text-ink">{kind === "fiscal" ? "fiscal (NFC-e)" : "não fiscal"}</strong>
        </p>

        {lines.length === 1 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Forma de pagamento">
            {SALE_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                data-autofocus={m === lines[0].method ? "" : undefined}
                aria-pressed={lines[0].method === m}
                onClick={() => pickSingle(m)}
                className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                  lines[0].method === m ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <label className="flex-1">
                  <span className="sr-only">Forma {i + 1}</span>
                  <select value={l.method} onChange={(e) => setLine(i, { method: e.target.value as SaleMethod })} className={inputClass}>
                    {SALE_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="w-32">
                  <span className="sr-only">Valor da forma {i + 1}</span>
                  <input value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} inputMode="decimal" className={inputClass} />
                </label>
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  aria-label={`Remover forma ${i + 1}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <X size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            setLines((ls) => {
              // dividir: a primeira linha fica com o que já tinha; a nova pega o que falta
              const first = ls.length === 1 ? [{ ...ls[0], amount: "" }] : ls;
              const used = first.reduce((acc, l) => acc + (parseBRL(l.amount) ?? 0), 0);
              const next: SaleMethod = first.some((l) => l.method === CASH) ? "04" : CASH;
              return [...first, { method: next, amount: centsToInput(Math.max(0, totalCents - used)) }];
            })
          }
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
        >
          <Plus size={16} aria-hidden /> Dividir em outra forma
        </button>

        {cash > 0 && (
          <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Valor recebido em dinheiro</span>
              <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder={centsToInput(cash)} className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              {cashSuggestions(cash).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReceived(centsToInput(v))}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums hover:bg-bg"
                >
                  {v === cash ? "Exato" : formatBRL(v)}
                </button>
              ))}
            </div>
            <p className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted">Troco</span>
              <span className="text-2xl font-extrabold tabular-nums">{formatBRL(Math.max(0, changeCents))}</span>
            </p>
          </div>
        )}

        {problem && (
          <p className="text-sm font-semibold text-danger" role="alert">
            {problem}
          </p>
        )}
      </div>
    </Modal>
  );
}
