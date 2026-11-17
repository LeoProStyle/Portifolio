"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink, Printer } from "lucide-react";
import { api } from "@/lib/client";
import { formatBRL } from "@/lib/money";
import type { SaleReceiptResponse } from "@/lib/types";
import { FISCAL_LABELS, methodLabel, saleNumber } from "./labels";

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

/** Comprovante não fiscal em bobina 80 mm (impresso pelo navegador). */
export function Receipt({ id, autoPrint }: { id: string; autoPrint: boolean }) {
  const [data, setData] = useState<SaleReceiptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SaleReceiptResponse>(`/api/vendas/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."));
  }, [id]);

  const fiscalOk = data?.sale.fiscal?.status === "autorizada";

  useEffect(() => {
    if (!data || !autoPrint || fiscalOk) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [data, autoPrint, fiscalOk]);

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto text-danger" aria-hidden />
        <p className="mt-2 font-semibold">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="mx-auto h-96 w-[80mm] animate-pulse rounded bg-surface-2" aria-busy="true" aria-label="Carregando" />;

  const { sale, company } = data;
  const canceled = sale.status === "cancelada";
  const cash = sale.payments.find((p) => p.method === "01");

  return (
    <div className="space-y-4">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .qg-receipt, .qg-receipt * { visibility: visible; }
          .qg-receipt { position: absolute; left: 0; top: 0; width: 72mm !important; margin: 0 4mm !important; box-shadow: none !important; border: 0 !important; }
        }
      `}</style>

      <div className="mx-auto flex max-w-sm flex-wrap items-center justify-between gap-2">
        <Link href="/vendas" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          <ArrowLeft size={14} aria-hidden /> Vendas
        </Link>
        {fiscalOk ? (
          sale.fiscal!.danfeUrl && sale.fiscal!.danfeUrl !== "about:blank" ? (
            <a href={sale.fiscal!.danfeUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bg">
              <ExternalLink size={16} aria-hidden /> Abrir DANFE NFC-e
            </a>
          ) : null
        ) : (
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bg">
            <Printer size={16} aria-hidden /> Imprimir
          </button>
        )}
      </div>

      {fiscalOk && (
        <p className="mx-auto max-w-sm rounded-xl bg-success-soft px-3 py-2 text-center text-sm font-semibold text-success">
          {FISCAL_LABELS.autorizada} — use o DANFE do provedor como cupom fiscal.
        </p>
      )}

      <article className="qg-receipt relative mx-auto w-[80mm] max-w-full bg-white px-[4mm] py-4 font-mono text-[12px] leading-snug text-black shadow-md">
        {canceled && (
          <p className="mb-2 border-2 border-black py-1 text-center text-base font-bold tracking-widest" role="status">
            CANCELADA
          </p>
        )}
        <header className="text-center">
          <p className="text-[14px] font-bold uppercase">{company.name}</p>
          {company.doc && <p>CNPJ {company.doc}</p>}
          {company.address && <p>{company.address}</p>}
          {company.phone && <p>Tel. {company.phone}</p>}
        </header>
        <hr className="my-2 border-dashed border-black" />
        <p className="flex justify-between gap-2">
          <span>Venda nº {saleNumber(sale.number)}</span>
          <span>{dateTime(sale.createdAt)}</span>
        </p>
        <hr className="my-2 border-dashed border-black" />
        <ul className="space-y-0.5">
          {sale.items.map((it) => (
            <li key={it.productId} className="flex justify-between gap-2">
              <span className="min-w-0 break-words">
                {it.qty} x {it.name}
              </span>
              <span className="shrink-0 tabular-nums">{formatBRL(it.totalCents).replace("R$", "").trim()}</span>
            </li>
          ))}
        </ul>
        <hr className="my-2 border-dashed border-black" />
        <p className="flex justify-between text-[14px] font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatBRL(sale.totalCents)}</span>
        </p>
        <ul className="mt-1">
          {sale.payments.map((p) => (
            <li key={p.method} className="flex justify-between">
              <span>{methodLabel(p.method)}</span>
              <span className="tabular-nums">{formatBRL(p.amountCents).replace("R$", "").trim()}</span>
            </li>
          ))}
          {cash && sale.receivedCents > 0 && (
            <>
              <li className="flex justify-between">
                <span>Recebido</span>
                <span className="tabular-nums">{formatBRL(sale.receivedCents).replace("R$", "").trim()}</span>
              </li>
              <li className="flex justify-between font-bold">
                <span>Troco</span>
                <span className="tabular-nums">{formatBRL(sale.changeCents).replace("R$", "").trim()}</span>
              </li>
            </>
          )}
        </ul>
        <hr className="my-2 border-dashed border-black" />
        {!fiscalOk && <p className="text-center font-bold">*** NÃO É DOCUMENTO FISCAL ***</p>}
        {fiscalOk && sale.fiscal!.accessKey && (
          <p className="break-all text-center text-[10px]">
            NFC-e {sale.fiscal!.number}/{sale.fiscal!.series} · Chave {sale.fiscal!.accessKey}
          </p>
        )}
        {company.footer && <p className="mt-1 text-center">{company.footer}</p>}
      </article>
    </div>
  );
}
