/**
 * Provedor Focus NFe (https://doc.focusnfe.com.br) — NFC-e síncrona.
 * Autenticação: HTTP Basic com o token como usuário e senha vazia.
 */
import type { FiscalEnv } from "@/lib/types";
import { buildFocusNfcePayload } from "./payload";
import { emptyResult, type FiscalProvider, type FiscalResult } from "./types";

const HOSTS: Record<FiscalEnv, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

const NO_RESPONSE = "Provedor fiscal não respondeu. Tente de novo.";

type FocusBody = Record<string, unknown> & {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  mensagem?: string;
  codigo?: string;
};

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export function createFocusProvider(opts: {
  token: string;
  environment: FiscalEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): FiscalProvider {
  const host = HOSTS[opts.environment];
  const doFetch = opts.fetchImpl ?? fetch;
  const auth = `Basic ${Buffer.from(`${opts.token}:`).toString("base64")}`;
  const abs = (path: unknown) => {
    const p = str(path);
    return p && p.startsWith("/") ? host + p : p;
  };

  /** Faz a chamada; null = sem resposta (rede/tempo esgotado). */
  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: FocusBody } | null> {
    try {
      const res = await doFetch(host + path, {
        method,
        headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
      const data = (await res.json().catch(() => ({}))) as FocusBody;
      return { status: res.status, data };
    } catch {
      return null;
    }
  }

  function toResult(d: FocusBody): FiscalResult {
    const sefazMsg = [str(d.status_sefaz), str(d.mensagem_sefaz)].filter(Boolean).join(" - ");
    const base: FiscalResult = {
      ...emptyResult("pendente"),
      accessKey: str(d.chave_nfe).replace(/^NFe/i, ""),
      number: str(d.numero),
      series: str(d.serie),
      protocol: str(d.protocolo ?? d.numero_protocolo),
      qrCodeUrl: str(d.qrcode_url),
      consultUrl: str(d.url_consulta_nf),
      xmlUrl: abs(d.caminho_xml_nota_fiscal),
      danfeUrl: abs(d.caminho_danfe),
      message: str(d.mensagem_sefaz),
    };
    if (d.status === "autorizado") return { ...base, status: "autorizada" };
    if (d.status === "erro_autorizacao" || d.status === "denegado") return { ...base, status: "rejeitada", message: sefazMsg || "Rejeitada pela SEFAZ" };
    return { ...base, status: "pendente", message: "NFC-e em processamento" };
  }

  async function consult(ref: string): Promise<FiscalResult | null> {
    const r = await call("GET", `/v2/nfce/${encodeURIComponent(ref)}`);
    if (!r) return emptyResult("erro", NO_RESPONSE);
    if (r.status === 404) return null;
    if (r.status >= 500) return emptyResult("erro", NO_RESPONSE);
    if (r.status >= 400) return emptyResult("erro", str(r.data.mensagem) || "Falha ao consultar a NFC-e");
    return toResult(r.data);
  }

  return {
    name: "focusnfe",
    environment: opts.environment,

    async emit(ref, sale, settings) {
      const r = await call("POST", `/v2/nfce?ref=${encodeURIComponent(ref)}`, buildFocusNfcePayload(sale, settings, new Date()));
      if (!r || r.status >= 500) return emptyResult("erro", NO_RESPONSE);
      // já existe nota/operação para essa ref (ex.: resposta anterior se perdeu) → pega o estado atual
      if (r.data.codigo === "already_processed" || r.data.codigo === "pending_operation") {
        return (await consult(ref)) ?? emptyResult("erro", NO_RESPONSE);
      }
      if (r.status >= 400) {
        const details = Array.isArray(r.data.erros) ? (r.data.erros as { mensagem?: string }[]).map((e) => e.mensagem).filter(Boolean) : [];
        return emptyResult("rejeitada", [str(r.data.mensagem), ...details].filter(Boolean).join(" — ") || "Requisição recusada pelo provedor");
      }
      return toResult(r.data);
    },

    consult,

    async cancel(ref, reason) {
      const r = await call("DELETE", `/v2/nfce/${encodeURIComponent(ref)}`, { justificativa: reason });
      if (!r || r.status >= 500) return { ok: false, message: NO_RESPONSE };
      if (r.data.status === "cancelado") return { ok: true, message: "" };
      return { ok: false, message: str(r.data.mensagem_sefaz) || str(r.data.mensagem) || "Cancelamento recusado" };
    },
  };
}
