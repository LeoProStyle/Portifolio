"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Lock, Minus, PackageOpen, Plus, RotateCcw, Search } from "lucide-react";
import { api, HttpError, post } from "@/lib/client";
import { formatLongDate, formatTime, formatWeekdayShort } from "@/lib/date";
import { formatBRL } from "@/lib/money";
import type { ProductDTO, RegisterDTO, RegisterItemDTO, SaidaResponse } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { NameTooltip } from "@/components/NameTooltip";
import { CloseDayDialog } from "./CloseDayDialog";
import { DayReport } from "./DayReport";

const ALL = "Todas";

/** Aplica +1/−1 localmente (atualização otimista). */
function applyDelta(reg: RegisterDTO, product: ProductDTO, delta: 1 | -1): RegisterDTO {
  const items = [...reg.items];
  const idx = items.findIndex((i) => i.productId === product.id);
  const current = idx >= 0 ? items[idx].qty : 0;
  const qty = Math.max(0, current + delta);
  if (qty === current) return reg;
  const item: RegisterItemDTO = {
    productId: product.id,
    name: product.name,
    category: product.category,
    emoji: product.emoji,
    priceCents: product.priceCents,
    qty,
  };
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  const visible = items.filter((i) => i.qty > 0);
  return {
    ...reg,
    items: visible,
    totalItems: visible.reduce((s, i) => s + i.qty, 0),
    totalCents: visible.reduce((s, i) => s + i.qty * i.priceCents, 0),
  };
}

export function SaidaBoard() {
  const [data, setData] = useState<SaidaResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null); // null = hoje
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [closing, setClosing] = useState(false);
  const [bump, setBump] = useState<string | null>(null);
  const [announce, setAnnounce] = useState(""); // aviso único para leitores de tela
  const pending = useRef(0);

  const load = useCallback(async (date: string | null) => {
    try {
      setLoadError(null);
      const res = await api<SaidaResponse>(`/api/saida${date ? `?date=${date}` : ""}`);
      setData(res);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load(viewDate);
  }, [load, viewDate]);

  // Se a página ficou aberta e virou o dia, recarrega ao voltar para a aba.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && pending.current === 0 && load(viewDate);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, viewDate]);

  const register = data?.register;
  const qtyById = useMemo(() => new Map(register?.items.map((i) => [i.productId, i.qty]) ?? []), [register]);

  const categories = useMemo(() => {
    const set = new Set(data?.products.map((p) => p.category));
    return [ALL, ...set];
  }, [data?.products]);

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = (data?.products ?? []).filter(
      (p) =>
        (category === ALL || p.category === category) &&
        (!term || p.name.toLocaleLowerCase("pt-BR").includes(term)),
    );
    const map = new Map<string, ProductDTO[]>();
    for (const p of filtered) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [data?.products, search, category]);

  const change = useCallback(
    async (product: ProductDTO, delta: 1 | -1) => {
      if (!data || data.register.status === "closed") return;
      const next = applyDelta(data.register, product, delta);
      if (next === data.register) return;
      setData({ ...data, register: next });
      const newQty = next.items.find((i) => i.productId === product.id)?.qty ?? 0;
      setAnnounce(`${product.name}: ${newQty} ${newQty === 1 ? "unidade" : "unidades"}`);
      if (delta === 1) {
        setBump(product.id);
        navigator.vibrate?.(8);
      }
      pending.current++;
      try {
        const res = await post<{ register: RegisterDTO }>("/api/saida/item", {
          productId: product.id,
          delta,
          date: data.register.date,
        });
        pending.current--;
        if (pending.current === 0) setData((d) => (d ? { ...d, register: res.register } : d));
      } catch (e) {
        pending.current--;
        toast(e instanceof Error ? e.message : "Não foi possível salvar.", "error");
        if (pending.current === 0) load(viewDate);
      }
    },
    [data, load, viewDate],
  );

  const reopen = async () => {
    if (!register) return;
    try {
      const res = await post<{ register: RegisterDTO }>("/api/saida/reopen", { date: register.date });
      setData((d) => (d ? { ...d, register: res.register } : d));
      toast("Dia reaberto.");
    } catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 403)) {
        toast("Só o dono pode reabrir o dia. Entre com o login do dono.", "error");
      } else toast(e instanceof Error ? e.message : "Erro ao reabrir.", "error");
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto text-danger" aria-hidden />
        <p className="mt-2 font-semibold">{loadError}</p>
        <button onClick={() => load(viewDate)} className="mt-4 rounded-xl bg-ink px-4 py-2 font-semibold text-bg">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!data || !register) return <BoardSkeleton />;

  const isToday = register.date === data.today;
  const closed = register.status === "closed";
  const pendingOthers = data.pendingDates.filter((d) => d !== register.date);

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>
      {/* Cabeçalho do dia */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isToday && (
            <button
              onClick={() => setViewDate(null)}
              className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand"
            >
              <ArrowLeft size={14} aria-hidden /> Voltar para hoje
            </button>
          )}
          <p className="text-sm font-medium text-muted">{isToday ? "Saída de hoje" : "Saída do dia"}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {formatLongDate(register.date)}
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
            closed ? "bg-surface-2 text-muted" : "bg-success-soft text-success"
          }`}
        >
          {closed ? <Lock size={14} aria-hidden /> : <span className="h-2 w-2 rounded-full bg-success" />}
          {closed ? `Fechado${register.closedAt ? ` às ${formatTime(register.closedAt)}` : ""}` : "Aberto"}
        </span>
      </section>

      {pendingOthers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
          <AlertTriangle size={18} className="text-brand" aria-hidden />
          <span className="font-semibold">Ficaram abertos:</span>
          {pendingOthers.map((d) => (
            <button
              key={d}
              onClick={() => setViewDate(d)}
              className="rounded-lg bg-surface px-2.5 py-1 font-semibold capitalize text-brand shadow-sm hover:underline"
            >
              {formatWeekdayShort(d)}
            </button>
          ))}
          <span className="text-muted">— toque para conferir e fechar.</span>
        </div>
      )}

      {closed ? (
        <div className="space-y-4">
          <DayReport register={register} />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={reopen}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 font-semibold hover:bg-surface-2"
            >
              <RotateCcw size={16} aria-hidden /> Reabrir dia (admin)
            </button>
            {isToday && (
              <p className="self-center text-sm text-muted">Amanhã um novo dia abre automaticamente.</p>
            )}
          </div>
        </div>
      ) : data.products.length === 0 ? (
        <EmptyProducts />
      ) : (
        <div>
          <div className="space-y-4">
            {/* Busca + categorias */}
            <div className="space-y-3">
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
                      category === c
                        ? "border-brand bg-brand text-brand-ink"
                        : "border-line bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted">
              Toque no produto ou em <strong className="text-ink">+</strong> a cada saída. Errou? Use{" "}
              <strong className="text-ink">−</strong>.
            </p>

            {groups.length === 0 && <p className="py-10 text-center text-muted">Nenhum produto encontrado.</p>}

            {groups.map(([cat, products]) => (
              <section key={cat} aria-labelledby={`cat-${cat}`}>
                <h2 id={`cat-${cat}`} className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  {cat}
                </h2>
                <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      qty={qtyById.get(p.id) ?? 0}
                      bump={bump === p.id}
                      onBumpEnd={() => setBump(null)}
                      onChange={change}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

        </div>
      )}

      {/* Único botão: a relação e as somatórias só aparecem no modal de fechamento */}
      {!closed && data.products.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-6xl sm:flex sm:justify-end">
            <button
              onClick={() => setClosing(true)}
              className="w-full rounded-2xl bg-ink px-8 py-3.5 text-base font-bold text-bg hover:opacity-90 active:scale-[0.98] sm:w-auto"
            >
              Fechar dia
            </button>
          </div>
        </div>
      )}

      <CloseDayDialog
        open={closing}
        register={register}
        onClose={() => setClosing(false)}
        onClosed={(r) => {
          setClosing(false);
          setData((d) => (d ? { ...d, register: r, pendingDates: d.pendingDates.filter((x) => x !== r.date) } : d));
          toast("Dia fechado e salvo!");
        }}
      />
    </div>
  );
}

function ProductCard({
  product,
  qty,
  bump,
  onBumpEnd,
  onChange,
}: {
  product: ProductDTO;
  qty: number;
  bump: boolean;
  onBumpEnd: () => void;
  onChange: (p: ProductDTO, d: 1 | -1) => void;
}) {
  const active = qty > 0;
  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border bg-surface p-3 transition-shadow ${
        active ? "border-brand shadow-[0_0_0_3px] shadow-brand/15" : "border-line"
      }`}
    >
      <NameTooltip text={product.name}>
        <button
          type="button"
          onClick={() => onChange(product, 1)}
          className="flex w-full items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
          aria-label={`Adicionar 1 ${product.name}, ${formatBRL(product.priceCents)}`}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-2xl" aria-hidden>
            {product.emoji || product.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            {/* até 2 linhas; se ainda cortar, o balão mostra o nome inteiro */}
            <span data-clamp className="line-clamp-2 break-words font-semibold leading-tight">
              {product.name}
            </span>
            <span className="text-sm text-muted tabular-nums">{formatBRL(product.priceCents)}</span>
          </span>
        </button>
      </NameTooltip>
      <div
        role="group"
        aria-label={`Quantidade de ${product.name}`}
        className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-1"
      >
        <button
          type="button"
          onClick={() => onChange(product, -1)}
          disabled={!active}
          aria-label={`Remover 1 ${product.name}`}
          className="grid h-12 w-12 place-items-center rounded-lg bg-surface text-ink shadow-sm transition active:scale-95 disabled:opacity-35 disabled:shadow-none"
        >
          <Minus size={20} aria-hidden />
        </button>
        <span
          key={bump ? `b${qty}` : qty}
          onAnimationEnd={onBumpEnd}
          className={`min-w-10 text-center text-2xl font-extrabold tabular-nums ${active ? "text-ink" : "text-muted"} ${
            bump ? "animate-pop" : ""
          }`}
        >
          {qty}
        </span>
        <button
          type="button"
          onClick={() => onChange(product, 1)}
          aria-label={`Adicionar 1 ${product.name}`}
          className="grid h-12 w-12 place-items-center rounded-lg bg-brand text-brand-ink shadow-sm transition active:scale-95"
        >
          <Plus size={22} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function SummaryList({ items }: { items: RegisterItemDTO[] }) {
  if (items.length === 0) return <p className="py-4 text-center text-sm text-muted">Nada anotado ainda.</p>;
  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return (
    <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto text-sm">
      {sorted.map((i) => (
        <li key={i.productId} className="flex items-center gap-2 py-2">
          <span className="w-8 shrink-0 rounded-md bg-brand-soft py-0.5 text-center font-bold text-brand tabular-nums">
            {i.qty}
          </span>
          <NameTooltip text={i.name} className="min-w-0 flex-1">
            <span data-clamp tabIndex={0} className="block truncate rounded outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
              {i.emoji && <span aria-hidden>{i.emoji} </span>}
              {i.name}
            </span>
          </NameTooltip>
          <span className="font-semibold tabular-nums">{formatBRL(i.qty * i.priceCents)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Totals({ totalItems, totalCents }: { totalItems: number; totalCents: number }) {
  return (
    <div className="flex items-end justify-between rounded-2xl bg-surface-2 px-4 py-3">
      <div>
        <p className="text-xs font-medium text-muted">Itens</p>
        <p className="text-lg font-bold tabular-nums">{totalItems}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-muted">Total</p>
        <p className="text-2xl font-extrabold tabular-nums">{formatBRL(totalCents)}</p>
      </div>
    </div>
  );
}

function EmptyProducts() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
      <PackageOpen className="mx-auto text-muted" size={36} aria-hidden />
      <h2 className="mt-3 text-lg font-bold">Nenhum produto cadastrado</h2>
      <p className="mt-1 text-muted">Cadastre os produtos da lanchonete no Admin para começar a anotar as saídas.</p>
      <Link href="/admin" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 font-bold text-brand-ink">
        Ir para o Admin
      </Link>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-4 w-28 rounded bg-surface-2" />
      <div className="h-8 w-72 rounded bg-surface-2" />
      <div className="h-12 rounded-2xl bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
