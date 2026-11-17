"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { CRT_LABELS, UFS } from "@/lib/fiscal";
import type { FiscalConfigResponse, FiscalSettingsDTO, ProductFiscalDTO } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { Field, FormError, PageTitle, inputClass } from "@/components/admin/finance/ui";

type Row = Omit<ProductFiscalDTO, "productId">;
const EMPTY_ROW: Row = { ncm: "", cfop: "", cest: "", unit: "", origin: "", taxCode: "" };

/** Configuração fiscal do caixa (só o dono): empresa, padrões e NCM de cada produto. */
export function FiscalConfig() {
  const [data, setData] = useState<FiscalConfigResponse | null>(null);
  const [settings, setSettings] = useState<FiscalSettingsDTO | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (res: FiscalConfigResponse) => {
    setData(res);
    setSettings(res.settings);
    const map: Record<string, Row> = {};
    for (const p of res.products) map[p.id] = { ...EMPTY_ROW };
    for (const f of res.fiscal) {
      const { productId, ...row } = f;
      map[productId] = row;
    }
    setRows(map);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      apply(await api<FiscalConfigResponse>("/api/vendas/config"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const products = useMemo(
    () => (data?.products ?? []).filter((p) => !onlyMissing || !rows[p.id]?.ncm),
    [data?.products, onlyMissing, rows],
  );

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto text-danger" aria-hidden />
        <p className="mt-2 font-semibold">{error}</p>
        <Link href="/vendas" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2 font-semibold text-bg">
          Voltar para Vendas
        </Link>
      </div>
    );
  }
  if (!data || !settings) return <div className="h-60 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" aria-label="Carregando" />;

  const company = settings.company;
  const setCompany = (patch: Partial<FiscalSettingsDTO["company"]>) => setSettings({ ...settings, company: { ...company, ...patch } });
  const setDefaults = (patch: Partial<FiscalSettingsDTO["defaults"]>) => setSettings({ ...settings, defaults: { ...settings.defaults, ...patch } });
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? EMPTY_ROW), ...patch } }));
  const { readiness } = data;
  const missingCount = data.products.filter((p) => p.active && !rows[p.id]?.ncm).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaveError(null);
    try {
      const res = await api<FiscalConfigResponse>("/api/vendas/config", {
        method: "PUT",
        body: JSON.stringify({ settings, products: Object.entries(rows).map(([productId, row]) => ({ productId, ...row })) }),
      });
      apply(res);
      toast("Configuração fiscal salva.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const cell = "w-full min-w-0 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <Link href="/vendas" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand">
          <ArrowLeft size={14} aria-hidden /> Voltar para Vendas
        </Link>
        <PageTitle title="Configuração fiscal" subtitle="Cupom fiscal (NFC-e)" />
      </div>

      <p className="flex gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <span>
          O certificado digital e o CSC ficam no painel do provedor (Focus NFe), não aqui. Confira NCM e tributação com o contador.
        </span>
      </p>

      {/* Status */}
      <section aria-labelledby="st" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="st" className="mb-2 font-bold">
          Status
        </h2>
        {readiness.provider ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 size={18} aria-hidden /> Provedor conectado — {readiness.provider === "mock" ? "simulado (testes)" : readiness.provider} ·{" "}
            {readiness.environment === "producao" ? "produção" : "homologação"}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <XCircle size={18} aria-hidden /> Provedor não configurado: defina FISCAL_PROVIDER e FOCUS_NFE_TOKEN na Vercel
          </p>
        )}
        {readiness.enabled ? (
          <p className="mt-1 text-sm text-muted">Cupom fiscal liberado no caixa{missingCount ? ` (exceto ${missingCount} produto(s) sem NCM)` : ""}.</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-sm text-muted">
            {readiness.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Empresa */}
      <section aria-labelledby="emp" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="emp" className="font-bold">
          Empresa
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CNPJ">
            <input value={company.doc} onChange={(e) => setCompany({ doc: e.target.value })} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Inscrição estadual (IE)">
            <input value={company.ie} onChange={(e) => setCompany({ ie: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Razão social">
            <input value={company.name} onChange={(e) => setCompany({ name: e.target.value })} required className={inputClass} />
          </Field>
          <Field label="Nome fantasia (comprovante)">
            <input value={settings.tradeName} onChange={(e) => setSettings({ ...settings, tradeName: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Regime tributário">
            <select value={company.crt} onChange={(e) => setCompany({ crt: e.target.value as typeof company.crt })} className={inputClass}>
              {Object.entries(CRT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Telefone">
            <input value={company.phone} onChange={(e) => setCompany({ phone: e.target.value })} inputMode="tel" className={inputClass} />
          </Field>
          <Field label="Rua" className="sm:col-span-2">
            <input value={company.street} onChange={(e) => setCompany({ street: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Número">
            <input value={company.number} onChange={(e) => setCompany({ number: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Bairro">
            <input value={company.district} onChange={(e) => setCompany({ district: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Cidade">
            <input value={company.city} onChange={(e) => setCompany({ city: e.target.value })} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="UF">
              <select value={company.uf} onChange={(e) => setCompany({ uf: e.target.value })} className={inputClass}>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label="CEP">
              <input value={company.cep} onChange={(e) => setCompany({ cep: e.target.value })} inputMode="numeric" className={inputClass} />
            </Field>
          </div>
          <Field label="Código IBGE do município">
            <input value={company.cityCode} onChange={(e) => setCompany({ cityCode: e.target.value })} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Mensagem no rodapé do comprovante" className="sm:col-span-2">
            <input
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              maxLength={120}
              placeholder="Obrigado, volte sempre!"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* Padrões */}
      <section aria-labelledby="pad" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="pad" className="font-bold">
          Padrões (usados quando o produto não tem valor próprio)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="CFOP">
            <input value={settings.defaults.cfop} onChange={(e) => setDefaults({ cfop: e.target.value })} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label={company.crt === "3" ? "CST ICMS" : "CSOSN"}>
            <input value={settings.defaults.taxCode} onChange={(e) => setDefaults({ taxCode: e.target.value })} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Origem">
            <input value={settings.defaults.origin} onChange={(e) => setDefaults({ origin: e.target.value })} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Unidade">
            <input value={settings.defaults.unit} onChange={(e) => setDefaults({ unit: e.target.value })} className={inputClass} />
          </Field>
        </div>
      </section>

      {/* Produtos */}
      <section aria-labelledby="prd" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="prd" className="font-bold">
            Produtos {missingCount > 0 && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">{missingCount} sem NCM</span>}
          </h2>
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            Só sem NCM
          </label>
        </div>
        <p className="text-sm text-muted">NCM é obrigatório para vender no fiscal. Campos vazios usam os padrões acima.</p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-2 font-bold">Produto</th>
                <th className="w-28 px-1 font-bold">NCM</th>
                <th className="w-20 px-1 font-bold">CFOP</th>
                <th className="w-24 px-1 font-bold">CEST</th>
                <th className="w-16 px-1 font-bold">Un.</th>
                <th className="w-16 px-1 font-bold">Orig.</th>
                <th className="w-20 px-1 font-bold">{company.crt === "3" ? "CST" : "CSOSN"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const r = rows[p.id] ?? EMPTY_ROW;
                const label = (f: string) => `${f} de ${p.name}`;
                return (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td className="py-2 pr-2">
                      <span className="font-semibold">{p.name}</span>
                      {!p.active && <span className="ml-1 text-xs text-muted">(inativo)</span>}
                    </td>
                    <td className="px-1">
                      <input aria-label={label("NCM")} value={r.ncm} onChange={(e) => setRow(p.id, { ncm: e.target.value.trim() })} inputMode="numeric" maxLength={8} className={`${cell} ${p.active && !r.ncm ? "border-danger/60" : ""}`} />
                    </td>
                    <td className="px-1">
                      <input aria-label={label("CFOP")} value={r.cfop} onChange={(e) => setRow(p.id, { cfop: e.target.value.trim() })} placeholder={settings.defaults.cfop} inputMode="numeric" maxLength={4} className={cell} />
                    </td>
                    <td className="px-1">
                      <input aria-label={label("CEST")} value={r.cest} onChange={(e) => setRow(p.id, { cest: e.target.value.trim() })} inputMode="numeric" maxLength={7} className={cell} />
                    </td>
                    <td className="px-1">
                      <input aria-label={label("Unidade")} value={r.unit} onChange={(e) => setRow(p.id, { unit: e.target.value.trim() })} placeholder={settings.defaults.unit} maxLength={6} className={cell} />
                    </td>
                    <td className="px-1">
                      <input aria-label={label("Origem")} value={r.origin} onChange={(e) => setRow(p.id, { origin: e.target.value.trim() })} placeholder={settings.defaults.origin} inputMode="numeric" maxLength={1} className={cell} />
                    </td>
                    <td className="px-1">
                      <input aria-label={label(company.crt === "3" ? "CST" : "CSOSN")} value={r.taxCode} onChange={(e) => setRow(p.id, { taxCode: e.target.value.trim() })} placeholder={settings.defaults.taxCode} inputMode="numeric" maxLength={3} className={cell} />
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted">
                    {onlyMissing ? "Todos os produtos têm NCM." : "Nenhum produto cadastrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FormError message={saveError} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-6xl sm:flex sm:justify-end">
          <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand px-8 py-3.5 text-base font-bold text-brand-ink disabled:opacity-60 sm:w-auto">
            {busy ? "Salvando…" : "Salvar configuração"}
          </button>
        </div>
      </div>
    </form>
  );
}
