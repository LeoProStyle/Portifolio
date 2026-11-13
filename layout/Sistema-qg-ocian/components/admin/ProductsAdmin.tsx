"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { NameTooltip } from "@/components/NameTooltip";
import { api, post } from "@/lib/client";
import { formatBRL } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { ProductForm, type ProductFormValues } from "./ProductForm";

type Filter = "all" | "active" | "inactive";

export function ProductsAdmin() {
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<ProductDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ products: ProductDTO[] }>("/api/products");
      setProducts(res.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => [...new Set(products?.map((p) => p.category))].sort(), [products]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (products ?? []).filter(
      (p) =>
        (filter === "all" || (filter === "active" ? p.active : !p.active)) &&
        (!term || `${p.name} ${p.category}`.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [products, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductDTO[]>();
    for (const p of visible) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [visible]);

  const save = async (values: ProductFormValues) => {
    if (editing) {
      await api(`/api/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(values) });
      toast("Produto atualizado.");
    } else {
      await post("/api/products", values);
      toast("Produto cadastrado.");
    }
    setFormOpen(false);
    load();
  };

  const toggle = async (p: ProductDTO) => {
    setProducts((list) => list?.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)) ?? null);
    try {
      await api(`/api/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
      load();
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      const res = await api<{ deleted: boolean; deactivated: boolean }>(`/api/products/${removing.id}`, {
        method: "DELETE",
      });
      toast(
        res.deleted ? "Produto removido." : "Produto já tinha saídas registradas: foi desativado para manter o histórico.",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao remover.", "error");
    }
    setRemoving(null);
    load();
  };

  const logout = async () => {
    await post("/api/auth/logout", {});
    window.location.assign("/saida");
  };

  const counts = {
    all: products?.length ?? 0,
    active: products?.filter((p) => p.active).length ?? 0,
    inactive: products?.filter((p) => !p.active).length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">Admin</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Produtos</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink"
          >
            <LogOut size={16} aria-hidden /> Sair
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-bold text-brand-ink"
          >
            <Plus size={18} aria-hidden /> Novo produto
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou categoria…"
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-11 pr-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
        <div className="flex gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="Filtro">
          {(
            [
              ["all", "Todos"],
              ["active", "Ativos"],
              ["inactive", "Inativos"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                filter === key ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {label} <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">{error}</p>}
      {!products && !error && <div className="h-48 animate-pulse rounded-3xl bg-surface-2" />}

      {products && products.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-lg font-bold">Nenhum produto ainda</p>
          <p className="text-muted">Cadastre o primeiro produto para ele aparecer na aba Saída.</p>
        </div>
      )}

      {grouped.map(([cat, list]) => (
        <section key={cat}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            {cat} <span className="font-medium">· {list.length}</span>
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
                  {p.emoji || p.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <NameTooltip text={p.name}>
                    <p
                      data-clamp
                      tabIndex={0}
                      className="truncate rounded font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {p.name}
                    </p>
                  </NameTooltip>
                  <p className="text-sm text-muted tabular-nums">{formatBRL(p.priceCents)}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <span className="hidden sm:inline">{p.active ? "Ativo" : "Inativo"}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={p.active}
                    onChange={() => toggle(p)}
                    aria-label={`${p.active ? "Desativar" : "Ativar"} ${p.name}`}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand/30" />
                </label>
                <button
                  onClick={() => {
                    setEditing(p);
                    setFormOpen(true);
                  }}
                  aria-label={`Editar ${p.name}`}
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => setRemoving(p)}
                  aria-label={`Remover ${p.name}`}
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ProductForm
        open={formOpen}
        initial={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />

      <Modal
        open={!!removing}
        title="Remover produto?"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <button
              onClick={() => setRemoving(null)}
              className="flex-1 rounded-2xl border border-line py-3 font-semibold hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              data-autofocus
              onClick={confirmRemove}
              className="flex-1 rounded-2xl bg-danger py-3 font-bold text-white"
            >
              Remover
            </button>
          </>
        }
      >
        <p>
          <strong>{removing?.name}</strong> vai sumir da aba Saída. Se ele já teve saídas registradas, será apenas
          desativado para manter o histórico do dashboard.
        </p>
      </Modal>
    </div>
  );
}
