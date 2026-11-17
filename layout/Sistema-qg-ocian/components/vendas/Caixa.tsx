"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Minus, PackageOpen, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/money";
import type { ProductDTO, SaleKind, VendasCatalogResponse } from "@/lib/types";
import { NameTooltip } from "@/components/NameTooltip";
import { Modal } from "@/components/Modal";
import { PaymentDialog } from "./PaymentDialog";

const ALL = "Todos";
const KIND_KEY = "qg-vendas-kind";

type Line = { product: ProductDTO; qty: number };

function readKind(): SaleKind {
  try {
    return localStorage.getItem(KIND_KEY) === "fiscal" ? "fiscal" : "nao_fiscal";
  } catch {
    return "nao_fiscal";
  }
}

export function Caixa({ catalog, onReload }: { catalog: VendasCatalogResponse; onReload: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [lines, setLines] = useState<Line[]>([]);
  const [kind, setKindState] = useState<SaleKind>(readKind);
  const [customerDoc, setCustomerDoc] = useState("");
  const [paying, setPaying] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const setKind = (k: SaleKind) => {
    setKindState(k);
    try {
      localStorage.setItem(KIND_KEY, k);
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  };

  const categories = useMemo(() => [ALL, ...new Set(catalog.products.map((p) => p.category))], [catalog.products]);
  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const map = new Map<string, ProductDTO[]>();
    for (const p of catalog.products) {
      if ((category === ALL || p.category === category) && (!term || p.name.toLocaleLowerCase("pt-BR").includes(term))) {
        map.set(p.category, [...(map.get(p.category) ?? []), p]);
      }
    }
    return [...map.entries()];
  }, [catalog.products, search, category]);

  const qtyById = useMemo(() => new Map(lines.map((l) => [l.product.id, l.qty])), [lines]);
  const totalCents = lines.reduce((acc, l) => acc + l.qty * l.product.priceCents, 0);
  const totalItems = lines.reduce((acc, l) => acc + l.qty, 0);

  // motivo para o cupom fiscal estar travado (null = liberado)
  const { readiness } = catalog;
  const missing = new Set(readiness.missingNcm);
  const noNcm = lines.find((l) => missing.has(l.product.id));
  const fiscalBlock = !readiness.enabled ? readiness.reasons[0] : noNcm ? `"${noNcm.product.name}" sem NCM` : null;
  const effectiveKind: SaleKind = kind === "fiscal" && !readiness.enabled ? "nao_fiscal" : kind;
  const canPay = lines.length > 0 && !(effectiveKind === "fiscal" && fiscalBlock);

  const change = (product: ProductDTO, delta: number) => {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      const qty = Math.max(0, Math.min(999, (found?.qty ?? 0) + delta));
      setAnnounce(`${product.name}: ${qty} no pedido`);
      if (!found) return qty > 0 ? [...prev, { product, qty }] : prev;
      return qty === 0 ? prev.filter((l) => l !== found) : prev.map((l) => (l === found ? { ...l, qty } : l));
    });
    if (delta > 0) navigator.vibrate?.(8);
  };

  const clear = () => {
    setLines([]);
    setCustomerDoc("");
  };

  if (catalog.products.length === 0) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
        <PackageOpen className="mx-auto text-muted" size={36} aria-hidden />
        <h2 className="mt-3 text-lg font-bold">Nenhum produto ativo</h2>
        <p className="mt-1 text-muted">Cadastre os produtos no Admin para vender.</p>
      </div>
    );
  }

  const order = (
    <OrderPanel
      lines={lines}
      totalCents={totalCents}
      kind={effectiveKind}
      fiscalBlock={fiscalBlock}
      fiscalEnabled={readiness.enabled}
      customerDoc={customerDoc}
      onCustomerDoc={setCustomerDoc}
      onKind={setKind}
      onChange={change}
      onClear={clear}
      onPay={() => {
        setCartOpen(false);
        setPaying(true);
      }}
      canPay={canPay}
    />
  );

  return (
    <div className="md:grid md:grid-cols-[1fr_340px] md:items-start md:gap-6">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>

      <div className="space-y-4">
        <label className="relative block">
          <span className="sr-only">Buscar produto</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-11 pr-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                category === c ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {groups.length === 0 && <p className="py-10 text-center text-muted">Nenhum produto encontrado.</p>}
        {groups.map(([cat, products]) => (
          <section key={cat} aria-labelledby={`vcat-${cat}`}>
            <h2 id={`vcat-${cat}`} className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              {cat}
            </h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {products.map((p) => {
                const qty = qtyById.get(p.id) ?? 0;
                return (
                  <li key={p.id}>
                    <NameTooltip text={p.name}>
                      <button
                        type="button"
                        onClick={() => change(p, 1)}
                        aria-label={`Adicionar ${p.name}, ${formatBRL(p.priceCents)}${qty ? `, ${qty} no pedido` : ""}`}
                        className={`relative flex h-full w-full flex-col items-start gap-1 rounded-2xl border bg-surface p-3 text-left outline-none transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand/30 ${
                          qty ? "border-brand shadow-[0_0_0_3px] shadow-brand/15" : "border-line hover:border-brand/50"
                        }`}
                      >
                        <span className="text-2xl" aria-hidden>
                          {p.emoji || p.name.charAt(0).toUpperCase()}
                        </span>
                        <span data-clamp className="line-clamp-2 break-words font-semibold leading-tight">
                          {p.name}
                        </span>
                        <span className="text-sm text-muted tabular-nums">{formatBRL(p.priceCents)}</span>
                        {qty > 0 && (
                          <span className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-1.5 text-sm font-extrabold text-brand-ink tabular-nums" aria-hidden>
                            {qty}
                          </span>
                        )}
                      </button>
                    </NameTooltip>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Pedido: coluna fixa no computador */}
      <aside className="sticky top-4 hidden md:block">{order}</aside>

      {/* Pedido: barra no rodapé no celular */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          disabled={lines.length === 0}
          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3.5 font-bold text-bg disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag size={18} aria-hidden />
            {totalItems} {totalItems === 1 ? "item" : "itens"} · {formatBRL(totalCents)}
          </span>
          <span>Ver pedido</span>
        </button>
      </div>
      <Modal open={cartOpen} title="Pedido" onClose={() => setCartOpen(false)}>
        {/* o modal já tem o título "Pedido" */}
        <div className="[&_h2]:sr-only">{order}</div>
      </Modal>

      <PaymentDialog
        open={paying}
        totalCents={totalCents}
        kind={effectiveKind}
        items={lines.map((l) => ({ productId: l.product.id, qty: l.qty }))}
        customerDoc={customerDoc}
        onClose={() => setPaying(false)}
        onDone={() => {
          setPaying(false);
          clear();
          onReload();
        }}
      />
    </div>
  );
}

function OrderPanel(props: {
  lines: Line[];
  totalCents: number;
  kind: SaleKind;
  fiscalBlock: string | null;
  fiscalEnabled: boolean;
  customerDoc: string;
  onCustomerDoc: (v: string) => void;
  onKind: (k: SaleKind) => void;
  onChange: (p: ProductDTO, delta: number) => void;
  onClear: () => void;
  onPay: () => void;
  canPay: boolean;
}) {
  const { lines, totalCents, kind, fiscalBlock, fiscalEnabled } = props;
  return (
    <div className="space-y-4 md:rounded-3xl md:border md:border-line md:bg-surface md:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pedido</h2>
        {lines.length > 0 && (
          <button type="button" onClick={props.onClear} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-danger">
            <Trash2 size={14} aria-hidden /> Limpar
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Toque nos produtos para montar o pedido.</p>
      ) : (
        <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <NameTooltip text={product.name}>
                  <span data-clamp tabIndex={0} className="block truncate rounded font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                    {product.name}
                  </span>
                </NameTooltip>
                <span className="text-sm text-muted tabular-nums">{formatBRL(qty * product.priceCents)}</span>
              </div>
              <div role="group" aria-label={`Quantidade de ${product.name}`} className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => props.onChange(product, -1)}
                  aria-label={qty === 1 ? `Remover ${product.name}` : `Tirar 1 ${product.name}`}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-surface shadow-sm active:scale-95"
                >
                  {qty === 1 ? <Trash2 size={16} aria-hidden /> : <Minus size={16} aria-hidden />}
                </button>
                <span className="min-w-7 text-center font-extrabold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => props.onChange(product, 1)}
                  aria-label={`Adicionar 1 ${product.name}`}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-brand-ink shadow-sm active:scale-95"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end justify-between rounded-2xl bg-surface-2 px-4 py-3">
        <span className="text-sm font-medium text-muted">Total</span>
        <span className="text-2xl font-extrabold tabular-nums">{formatBRL(totalCents)}</span>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Cupom</legend>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
          <button
            type="button"
            aria-pressed={kind === "nao_fiscal"}
            onClick={() => props.onKind("nao_fiscal")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${kind === "nao_fiscal" ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
          >
            Não fiscal
          </button>
          <button
            type="button"
            aria-pressed={kind === "fiscal"}
            disabled={!fiscalEnabled}
            onClick={() => props.onKind("fiscal")}
            className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
              kind === "fiscal" ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
          >
            {!fiscalEnabled && <Lock size={14} aria-hidden />} Fiscal (NFC-e)
          </button>
        </div>
        {fiscalBlock && (kind === "fiscal" || !fiscalEnabled) && (
          <p className="mt-2 text-sm text-muted" role={kind === "fiscal" ? "alert" : undefined}>
            {fiscalBlock}
            {!fiscalEnabled && " — cupom fiscal indisponível."}
          </p>
        )}
      </fieldset>

      {kind === "fiscal" && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">CPF/CNPJ na nota (opcional)</span>
          <input
            value={props.customerDoc}
            onChange={(e) => props.onCustomerDoc(e.target.value)}
            inputMode="numeric"
            placeholder="Só se o cliente pedir"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
      )}

      <button
        type="button"
        onClick={props.onPay}
        disabled={!props.canPay}
        className="w-full rounded-2xl bg-brand px-6 py-3.5 text-base font-bold text-brand-ink hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
      >
        Pagamento →
      </button>
      {!fiscalEnabled && (
        <p className="text-center text-xs text-muted">
          <Link href="/vendas/config" className="underline">
            Configuração fiscal
          </Link>{" "}
          (só o dono)
        </p>
      )}
    </div>
  );
}
