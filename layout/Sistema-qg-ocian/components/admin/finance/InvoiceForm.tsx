"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toaster";
import { TIMEZONE, todayKey } from "@/lib/date";
import {
  CRT_LABELS,
  IE_IND_LABELS,
  PAYMENT_METHODS,
  UFS,
  cleanDoc,
  formatDoc,
  isValidAccessKey,
  isValidCNPJ,
  isValidDoc,
  itemTotalCents,
  onlyDigits,
  parseAccessKey,
} from "@/lib/fiscal";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import type { InvoiceDTO, InvoiceKind, PartyDTO } from "@/lib/types";
import { ConfirmFooter, Field, FormError, inputClass, parseQty } from "./ui";

export type InvoicePayload = Omit<InvoiceDTO, "id" | "cNF" | "totalCents" | "items"> & {
  items: Omit<InvoiceDTO["items"][number], "totalCents">[];
};

const BLANK_PARTY: PartyDTO = {
  doc: "",
  name: "",
  ie: "",
  crt: "3",
  ieIndicator: "9",
  street: "",
  number: "",
  district: "",
  cityCode: "",
  city: "",
  uf: "SP",
  cep: "",
  phone: "",
};

/** Destinatário padrão = a loja (mesmos dados do XML de referência em docs/ref). */
const STORE_RECIPIENT: PartyDTO = {
  ...BLANK_PARTY,
  doc: "66857779000174",
  name: "QG Ocian",
  street: "Rua Consumidor",
  number: "0",
  district: "Centro",
  cityCode: "3550308",
  city: "SAO PAULO",
  uf: "SP",
  cep: "01001000",
};

type ItemForm = {
  code: string;
  ean: string;
  description: string;
  ncm: string;
  cest: string;
  cfop: string;
  unit: string;
  qty: string;
  price: string;
  more: boolean;
};
type PaymentForm = { method: string; amount: string };

const blankItem = (): ItemForm => ({ code: "", ean: "", description: "", ncm: "", cest: "", cfop: "", unit: "un", qty: "1", price: "", more: false });

const nowTime = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

/** "São Paulo" → "SAO PAULO" (como no XML de referência). */
const upperNoAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/* ------------------------------------------------------------------ */

function PartyFields({
  idPrefix,
  value,
  onChange,
  role,
}: {
  idPrefix: string;
  value: PartyDTO;
  onChange: (p: PartyDTO) => void;
  role: "emitter" | "recipient";
}) {
  const [cepBusy, setCepBusy] = useState(false);
  const set = (patch: Partial<PartyDTO>) => onChange({ ...value, ...patch });
  const doc = cleanDoc(value.doc);
  const docInvalid = doc.length > 0 && (doc.length === 11 || doc.length === 14) && !isValidDoc(doc);

  /** Busca endereço e código IBGE do município pelo CEP (ViaCEP). */
  const lookupCep = async () => {
    const cep = onlyDigits(value.cep);
    if (cep.length !== 8) return toast("Digite o CEP com 8 dígitos.", "error");
    setCepBusy(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string; ibge?: string };
      if (d.erro) throw new Error("CEP não encontrado.");
      set({
        street: d.logradouro || value.street,
        district: d.bairro || value.district,
        city: d.localidade ? upperNoAccent(d.localidade) : value.city,
        uf: d.uf || value.uf,
        cityCode: d.ibge || value.cityCode,
      });
    } catch (e) {
      toast(e instanceof Error && e.message === "CEP não encontrado." ? e.message : "Não consegui buscar o CEP. Preencha à mão.", "error");
    } finally {
      setCepBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-6 gap-3">
      <Field label="CNPJ / CPF" className="col-span-6 sm:col-span-2">
        <input
          className={`${inputClass} tabular-nums ${docInvalid ? "border-danger" : ""}`}
          value={value.doc.length >= 11 ? formatDoc(value.doc) : value.doc}
          onChange={(e) => set({ doc: cleanDoc(e.target.value).slice(0, 14) })}
          inputMode="text"
          aria-invalid={docInvalid}
          aria-describedby={docInvalid ? `${idPrefix}-doc-err` : undefined}
          placeholder="00.000.000/0000-00"
        />
        {docInvalid && (
          <span id={`${idPrefix}-doc-err`} className="mt-1 block text-xs font-semibold text-danger">
            Dígito verificador não confere
          </span>
        )}
      </Field>
      <Field label={role === "emitter" ? "Razão social / nome" : "Nome"} className="col-span-6 sm:col-span-4">
        <input className={inputClass} required maxLength={60} value={value.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Inscrição estadual" className="col-span-3 sm:col-span-2">
        <input className={inputClass} maxLength={14} value={value.ie} onChange={(e) => set({ ie: e.target.value.toUpperCase() })} placeholder="Opcional" />
      </Field>
      {role === "emitter" ? (
        <Field label="Regime tributário" className="col-span-3 sm:col-span-2">
          <select className={inputClass} value={value.crt} onChange={(e) => set({ crt: e.target.value as PartyDTO["crt"] })}>
            {Object.entries(CRT_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Indicador da IE" className="col-span-3 sm:col-span-2">
          <select className={inputClass} value={value.ieIndicator} onChange={(e) => set({ ieIndicator: e.target.value as PartyDTO["ieIndicator"] })}>
            {Object.entries(IE_IND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Telefone" className="col-span-6 sm:col-span-2">
        <input className={inputClass} inputMode="tel" value={value.phone} onChange={(e) => set({ phone: onlyDigits(e.target.value).slice(0, 14) })} placeholder="Opcional" />
      </Field>

      <div className="col-span-6 sm:col-span-2">
        <span className="mb-1 block text-sm font-semibold" id={`${idPrefix}-cep-l`}>
          CEP
        </span>
        <div className="flex gap-1.5">
          <input
            aria-labelledby={`${idPrefix}-cep-l`}
            className={`${inputClass} tabular-nums`}
            inputMode="numeric"
            value={value.cep}
            onChange={(e) => set({ cep: onlyDigits(e.target.value).slice(0, 8) })}
            placeholder="Opcional"
          />
          <button
            type="button"
            onClick={lookupCep}
            disabled={cepBusy}
            title="Buscar endereço pelo CEP"
            aria-label="Buscar endereço pelo CEP"
            className="grid w-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-surface-2 disabled:opacity-50"
          >
            <Search size={16} aria-hidden />
          </button>
        </div>
      </div>
      <Field label="Logradouro" className="col-span-6 sm:col-span-3">
        <input className={inputClass} maxLength={60} value={value.street} onChange={(e) => set({ street: e.target.value })} />
      </Field>
      <Field label="Número" className="col-span-2 sm:col-span-1">
        <input className={inputClass} maxLength={60} value={value.number} onChange={(e) => set({ number: e.target.value })} />
      </Field>
      <Field label="Bairro" className="col-span-4 sm:col-span-2">
        <input className={inputClass} maxLength={60} value={value.district} onChange={(e) => set({ district: e.target.value })} />
      </Field>
      <Field label="Município" className="col-span-6 sm:col-span-2">
        <input className={inputClass} maxLength={60} value={value.city} onChange={(e) => set({ city: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Cód. IBGE" className="col-span-4 sm:col-span-1">
        <input
          className={`${inputClass} tabular-nums`}
          inputMode="numeric"
          value={value.cityCode}
          onChange={(e) => set({ cityCode: onlyDigits(e.target.value).slice(0, 7) })}
          placeholder="Opcional"
        />
      </Field>
      <Field label="UF" className="col-span-2 sm:col-span-1">
        <select className={inputClass} value={value.uf} onChange={(e) => set({ uf: e.target.value })}>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */

type Props = {
  open: boolean;
  initial: InvoiceDTO | null;
  emitters: PartyDTO[];
  lastRecipient: PartyDTO | null;
  onClose: () => void;
  onSubmit: (payload: InvoicePayload) => Promise<void>;
};

export function InvoiceForm({ open, initial, emitters, lastRecipient, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<InvoiceKind>("fiscal");
  const [model, setModel] = useState<"55" | "65">("55");
  const [series, setSeries] = useState("1");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayKey());
  const [issueTime, setIssueTime] = useState("00:00");
  const [natOp, setNatOp] = useState("VENDA");
  const [accessKey, setAccessKey] = useState("");
  const [emitter, setEmitter] = useState<PartyDTO>(BLANK_PARTY);
  const [recipient, setRecipient] = useState<PartyDTO>(STORE_RECIPIENT);
  const [items, setItems] = useState<ItemForm[]>([blankItem()]);
  const [payments, setPayments] = useState<PaymentForm[]>([{ method: "01", amount: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setKind(initial.kind);
      setModel(initial.model);
      setSeries(String(initial.series));
      setNumber(String(initial.number));
      setIssueDate(initial.issueDate);
      setIssueTime(initial.issueTime);
      setNatOp(initial.natOp);
      setAccessKey(initial.accessKey);
      setEmitter(initial.emitter);
      setRecipient(initial.recipient);
      setItems(
        initial.items.map((it) => ({
          code: it.code,
          ean: it.ean,
          description: it.description,
          ncm: it.ncm === "00000000" ? "" : it.ncm,
          cest: it.cest,
          cfop: it.cfop,
          unit: it.unit,
          qty: String(it.qty).replace(".", ","),
          price: centsToInput(it.unitCents),
          more: Boolean(it.code || it.ean || it.cest || it.cfop || (it.ncm && it.ncm !== "00000000")),
        })),
      );
      setPayments(initial.payments.map((p) => ({ method: p.method, amount: centsToInput(p.amountCents) })));
      setNotes(initial.notes);
    } else {
      setKind("fiscal");
      setModel("55");
      setSeries("1");
      setNumber("");
      setIssueDate(todayKey());
      setIssueTime(nowTime());
      setNatOp("VENDA");
      setAccessKey("");
      setEmitter(BLANK_PARTY);
      setRecipient(lastRecipient ?? STORE_RECIPIENT);
      setItems([blankItem()]);
      setPayments([{ method: "01", amount: "" }]);
      setNotes("");
    }
  }, [open, initial, lastRecipient]);

  const lineTotals = items.map((it) => {
    const qty = parseQty(it.qty);
    const unitCents = parseBRL(it.price);
    return qty !== null && unitCents !== null ? itemTotalCents({ qty, unitCents }) : null;
  });
  const total = lineTotals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  const paid = payments.reduce((acc, p) => acc + (parseBRL(p.amount) ?? 0), 0);

  // com uma forma de pagamento só, o valor acompanha o total do cupom
  useEffect(() => {
    setPayments((list) => (list.length === 1 ? [{ ...list[0], amount: total ? centsToInput(total) : "" }] : list));
  }, [total]);

  const keyDigits = cleanDoc(accessKey);
  const keyStatus = keyDigits.length === 0 ? null : keyDigits.length < 44 ? `${keyDigits.length}/44` : isValidAccessKey(keyDigits) ? "ok" : "invalid";

  const onKeyChange = (raw: string) => {
    const v = cleanDoc(raw).slice(0, 44);
    setAccessKey(v);
    const k = parseAccessKey(v);
    if (!k) return;
    setModel(k.model === "65" ? "65" : "55");
    setSeries(String(k.series));
    setNumber(String(k.number));
    const known = emitters.find((e) => cleanDoc(e.doc).padStart(14, "0") === k.emitterDoc);
    // emitente pessoa física aparece na chave como "000" + CPF
    const doc = isValidCNPJ(k.emitterDoc) ? k.emitterDoc : k.emitterDoc.slice(3);
    setEmitter((e) => known ?? { ...e, doc, uf: k.uf ?? e.uf });
    if (!issueDate.startsWith(k.yearMonth)) setIssueDate(`${k.yearMonth}-01`);
    toast(known ? `Chave lida · emitente ${known.name}` : "Chave lida: modelo, série, número e CNPJ preenchidos.");
  };

  const emitterOptions = useMemo(() => emitters.filter((e) => e.name), [emitters]);

  const updateItem = (i: number, patch: Partial<ItemForm>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedItems = [];
    for (const [i, it] of items.entries()) {
      const qty = parseQty(it.qty);
      const unitCents = parseBRL(it.price);
      if (!it.description.trim()) return setError(`Item ${i + 1}: informe a descrição.`);
      if (!qty) return setError(`Item ${i + 1}: quantidade inválida (até 4 casas, ex.: 1,5).`);
      if (unitCents === null) return setError(`Item ${i + 1}: valor unitário inválido.`);
      parsedItems.push({
        code: it.code.trim(),
        ean: it.ean.trim().toUpperCase(),
        description: it.description.trim(),
        ncm: onlyDigits(it.ncm) || "00000000",
        cest: onlyDigits(it.cest),
        cfop: onlyDigits(it.cfop),
        unit: it.unit.trim() || "un",
        qty,
        unitCents,
      });
    }
    const parsedPayments = [];
    for (const p of payments) {
      const amountCents = parseBRL(p.amount);
      if (amountCents === null) return setError("Valor de pagamento inválido.");
      parsedPayments.push({ method: p.method, amountCents });
    }
    if (paid !== total) return setError(`A soma dos pagamentos (${formatBRL(paid)}) precisa ser igual ao total (${formatBRL(total)}).`);
    const n = Number.parseInt(number, 10);
    if (!n) return setError("Informe o número do cupom.");

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        model,
        series: Number.parseInt(series, 10) || 0,
        number: n,
        issueDate,
        issueTime,
        natOp: natOp.trim() || "VENDA",
        accessKey: keyDigits,
        emitter,
        recipient,
        items: parsedItems,
        payments: parsedPayments,
        notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      open={open}
      title={initial?.id ? "Editar cupom" : initial ? "Novo cupom (cópia)" : "Novo cupom"}
      onClose={saving ? () => undefined : onClose}
      footer={<ConfirmFooter onCancel={onClose} confirmLabel={initial?.id ? "Salvar alterações" : "Cadastrar cupom"} busy={saving} formId="invoice-form" />}
    >
      <form id="invoice-form" onSubmit={submit} className="space-y-4">
        <Section title="Documento">
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Tipo de cupom">
            {(
              [
                ["fiscal", "Cupom fiscal"],
                ["nao_fiscal", "Cupom não fiscal"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${kind === k ? "border-brand bg-brand-soft" : "border-line bg-bg text-muted hover:bg-surface-2"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <Field label="Chave de acesso (opcional — preenche modelo, série, número e CNPJ)">
            <input
              className={`${inputClass} font-mono text-sm tracking-wide ${keyStatus === "invalid" ? "border-danger" : ""}`}
              value={accessKey.replace(/(.{4})/g, "$1 ").trim()}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              aria-describedby="key-status"
              aria-invalid={keyStatus === "invalid"}
            />
            <span id="key-status" className={`mt-1 block text-xs font-semibold ${keyStatus === "invalid" ? "text-danger" : keyStatus === "ok" ? "text-success" : "text-muted"}`}>
              {keyStatus === null && "Sem chave, o sistema calcula uma a partir dos dados do cupom."}
              {keyStatus === "ok" && "Chave válida"}
              {keyStatus === "invalid" && "Chave inválida (dígito verificador não confere)"}
              {keyStatus && keyStatus.includes("/") && `${keyStatus} dígitos`}
            </span>
          </Field>

          <div className="grid grid-cols-6 gap-3">
            <Field label="Modelo" className="col-span-6 sm:col-span-2">
              <select className={inputClass} value={model} onChange={(e) => setModel(e.target.value as "55" | "65")}>
                <option value="55">55 · NF-e</option>
                <option value="65">65 · NFC-e (cupom)</option>
              </select>
            </Field>
            <Field label="Número" className="col-span-4 sm:col-span-2">
              <input className={`${inputClass} tabular-nums`} inputMode="numeric" required value={number} onChange={(e) => setNumber(onlyDigits(e.target.value).slice(0, 9))} />
            </Field>
            <Field label="Série" className="col-span-2 sm:col-span-2">
              <input className={`${inputClass} tabular-nums`} inputMode="numeric" value={series} onChange={(e) => setSeries(onlyDigits(e.target.value).slice(0, 3))} />
            </Field>
            <Field label="Data de emissão" className="col-span-3 sm:col-span-2">
              <input className={inputClass} type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Hora" className="col-span-3 sm:col-span-1">
              <input className={inputClass} type="time" value={issueTime} onChange={(e) => setIssueTime(e.target.value || "00:00")} />
            </Field>
            <Field label="Natureza da operação" className="col-span-6 sm:col-span-3">
              <input className={inputClass} maxLength={60} value={natOp} onChange={(e) => setNatOp(e.target.value.toUpperCase())} />
            </Field>
          </div>
        </Section>

        <Section
          title="Emitente (quem vendeu)"
          aside={
            emitterOptions.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Já cadastrado:</span>
                <select
                  className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm"
                  value=""
                  onChange={(e) => {
                    const chosen = emitterOptions[Number(e.target.value)];
                    if (chosen) setEmitter(chosen);
                  }}
                >
                  <option value="">Escolher…</option>
                  {emitterOptions.map((em, i) => (
                    <option key={`${em.doc}-${em.name}`} value={i}>
                      {em.name}
                      {em.doc ? ` · ${formatDoc(em.doc)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        >
          <PartyFields idPrefix="emit" value={emitter} onChange={setEmitter} role="emitter" />
        </Section>

        <details className="group rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
            <span>
              <span className="block text-sm font-extrabold uppercase tracking-wider text-muted">Destinatário (quem comprou)</span>
              <span className="text-sm">
                {recipient.name || "—"}
                {recipient.doc && ` · ${formatDoc(recipient.doc)}`}
              </span>
            </span>
            <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <PartyFields idPrefix="dest" value={recipient} onChange={setRecipient} role="recipient" />
            <button type="button" onClick={() => setRecipient(STORE_RECIPIENT)} className="text-sm font-semibold text-brand hover:underline">
              Usar dados da loja (QG Ocian)
            </button>
          </div>
        </details>

        <Section
          title={`Itens · ${items.length}`}
          aside={
            <button type="button" onClick={() => setItems([...items, blankItem()])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              <Plus size={16} aria-hidden /> Adicionar item
            </button>
          }
        >
          <ol className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="rounded-xl bg-surface-2 p-3">
                <div className="grid grid-cols-12 gap-2">
                  <Field label={`Item ${i + 1} · descrição`} className="col-span-12 sm:col-span-5">
                    <input className={inputClass} required maxLength={120} value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                  </Field>
                  <Field label="Qtd." className="col-span-3 sm:col-span-2">
                    <input className={`${inputClass} tabular-nums`} inputMode="decimal" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} />
                  </Field>
                  <Field label="Un." className="col-span-3 sm:col-span-1">
                    <input className={inputClass} maxLength={6} value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} />
                  </Field>
                  <Field label="Valor unit." className="col-span-6 sm:col-span-2">
                    <input className={`${inputClass} tabular-nums`} inputMode="decimal" placeholder="0,00" value={it.price} onChange={(e) => updateItem(i, { price: e.target.value })} />
                  </Field>
                  <div className="col-span-12 flex items-end justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                    <span className="text-xs text-muted sm:mb-0">Total</span>
                    <span className="font-extrabold tabular-nums sm:py-2.5">{lineTotals[i] === null ? "—" : formatBRL(lineTotals[i]!)}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => updateItem(i, { more: !it.more })}
                    aria-expanded={it.more}
                    className="text-sm font-semibold text-muted hover:text-ink"
                  >
                    {it.more ? "− Menos campos" : "+ Código, NCM, CFOP, CEST, EAN"}
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                      aria-label={`Remover item ${i + 1}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  )}
                </div>
                {it.more && (
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    <Field label="Código" className="col-span-3 sm:col-span-2">
                      <input className={inputClass} maxLength={60} placeholder={`ITEM${i + 1}`} value={it.code} onChange={(e) => updateItem(i, { code: e.target.value })} />
                    </Field>
                    <Field label="NCM" className="col-span-3 sm:col-span-1">
                      <input className={`${inputClass} tabular-nums`} inputMode="numeric" placeholder="00000000" value={it.ncm} onChange={(e) => updateItem(i, { ncm: onlyDigits(e.target.value).slice(0, 8) })} />
                    </Field>
                    <Field label="CFOP" className="col-span-2 sm:col-span-1">
                      <input className={`${inputClass} tabular-nums`} inputMode="numeric" value={it.cfop} onChange={(e) => updateItem(i, { cfop: onlyDigits(e.target.value).slice(0, 4) })} />
                    </Field>
                    <Field label="CEST" className="col-span-2 sm:col-span-1">
                      <input className={`${inputClass} tabular-nums`} inputMode="numeric" value={it.cest} onChange={(e) => updateItem(i, { cest: onlyDigits(e.target.value).slice(0, 7) })} />
                    </Field>
                    <Field label="EAN / GTIN" className="col-span-2 sm:col-span-1">
                      <input className={`${inputClass} tabular-nums`} maxLength={14} value={it.ean} onChange={(e) => updateItem(i, { ean: e.target.value })} />
                    </Field>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
            <span className="font-semibold">Total do cupom</span>
            <span className="text-xl font-extrabold tabular-nums">{formatBRL(total)}</span>
          </div>
        </Section>

        <Section
          title="Pagamento"
          aside={
            <button type="button" onClick={() => setPayments([...payments, { method: "17", amount: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              <Plus size={16} aria-hidden /> Dividir pagamento
            </button>
          }
        >
          {payments.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={payments.length > 1 ? `Forma ${i + 1}` : "Forma"} className="flex-1">
                <select className={inputClass} value={p.method} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                  {Object.entries(PAYMENT_METHODS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {code} · {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor" className="w-32 sm:w-40">
                <input
                  className={`${inputClass} tabular-nums`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={p.amount}
                  onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
              </Field>
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPayments(payments.filter((_, j) => j !== i))}
                  aria-label={`Remover forma ${i + 1}`}
                  className="mb-1 grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          ))}
          {payments.length > 1 && (
            <p className={`text-sm font-semibold ${paid === total ? "text-success" : "text-danger"}`}>
              Pago {formatBRL(paid)} de {formatBRL(total)}
              {paid !== total && ` · falta ${formatBRL(total - paid)}`}
            </p>
          )}
        </Section>

        <Field label="Informações complementares">
          <textarea className={`${inputClass} min-h-16`} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </Field>

        <FormError message={error} />
      </form>
    </Modal>
  );
}
