import { describe, expect, it } from "vitest";
import { buildFocusNfcePayload } from "@/lib/fiscal-provider/payload";
import { createFocusProvider } from "@/lib/fiscal-provider/focusnfe";
import { createMockProvider } from "@/lib/fiscal-provider/mock";
import { getFiscalProvider } from "@/lib/fiscal-provider";
import type { FiscalSettingsDTO, SaleDTO } from "@/lib/types";

const settings = (crt: "1" | "3" = "1"): FiscalSettingsDTO => ({
  company: {
    doc: "11222333000181",
    name: "QG Ocian LTDA",
    ie: "123456789",
    crt,
    ieIndicator: "9",
    street: "",
    number: "",
    district: "",
    cityCode: "",
    city: "",
    uf: "SP",
    cep: "",
    phone: "",
  },
  tradeName: "QG Ocian",
  receiptFooter: "",
  defaults: { cfop: "5102", taxCode: crt === "3" ? "00" : "102", origin: "0", unit: "UN" },
});

const sale = (over: Partial<SaleDTO> = {}): SaleDTO => ({
  id: "65a000000000000000000001",
  number: 1,
  date: "2026-11-17",
  createdAt: "2026-11-17T17:32:00.000Z",
  kind: "fiscal",
  items: [
    {
      productId: "p1",
      name: "Café",
      category: "Bebidas",
      emoji: "☕",
      unitCents: 500,
      qty: 2,
      totalCents: 1000,
      fiscal: { ncm: "21011110", cfop: "5102", cest: "", unit: "UN", origin: "0", taxCode: "102" },
    },
  ],
  totalCents: 1000,
  payments: [{ method: "01", amountCents: 1000 }],
  receivedCents: 2000,
  changeCents: 1000,
  customerDoc: "",
  status: "concluida",
  cancelReason: "",
  canceledAt: null,
  fiscal: null,
  ...over,
});

const issued = new Date("2026-11-17T17:32:00.000Z");

describe("buildFocusNfcePayload", () => {
  it("monta cabeçalho, item e pagamento no formato da Focus", () => {
    const p = buildFocusNfcePayload(sale(), settings(), issued);
    expect(p).toMatchObject({
      cnpj_emitente: "11222333000181",
      data_emissao: "2026-11-17T14:32:00-03:00",
      natureza_operacao: "VENDA AO CONSUMIDOR",
      presenca_comprador: "1",
      modalidade_frete: "9",
      local_destino: "1",
      formas_pagamento: [{ forma_pagamento: "01", valor_pagamento: "10.00" }],
    });
    expect(p.items).toEqual([
      {
        numero_item: "1",
        codigo_produto: "p1",
        descricao: "Café",
        codigo_ncm: "21011110",
        cfop: "5102",
        unidade_comercial: "UN",
        unidade_tributavel: "UN",
        quantidade_comercial: "2.0000",
        quantidade_tributavel: "2.0000",
        valor_unitario_comercial: "5.00",
        valor_unitario_tributavel: "5.00",
        valor_bruto: "10.00",
        icms_origem: "0",
        icms_situacao_tributaria: "102",
      },
    ]);
    expect(p).not.toHaveProperty("cpf_destinatario");
    expect(p).not.toHaveProperty("valor_troco");
  });
  it("regime normal usa o CST do padrão quando o item vem com CSOSN de Simples", () => {
    const s = sale();
    s.items[0].fiscal!.taxCode = "";
    const p = buildFocusNfcePayload(s, settings("3"), issued) as { items: { icms_situacao_tributaria: string }[] };
    expect(p.items[0].icms_situacao_tributaria).toBe("00");
  });
  it("CPF ou CNPJ na nota", () => {
    expect(buildFocusNfcePayload(sale({ customerDoc: "52998224725" }), settings(), issued)).toMatchObject({ cpf_destinatario: "52998224725" });
    expect(buildFocusNfcePayload(sale({ customerDoc: "11222333000181" }), settings(), issued)).toMatchObject({ cnpj_destinatario: "11222333000181" });
  });
});

type Call = { url: string; init: RequestInit };
const fakeFetch = (status: number, body: unknown, calls: Call[] = []) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

describe("createFocusProvider", () => {
  it("autorizado → autorizada, com URLs absolutas e auth básica", async () => {
    const calls: Call[] = [];
    const provider = createFocusProvider({
      token: "tok",
      environment: "homologacao",
      fetchImpl: fakeFetch(
        201,
        {
          status: "autorizado",
          chave_nfe: "NFe35261111222333000181650010000000011000000019",
          numero: "1",
          serie: "1",
          protocolo: "135260000000001",
          caminho_danfe: "/notas_fiscais_consumidor/NFe1.html",
          caminho_xml_nota_fiscal: "/arquivos/1.xml",
          qrcode_url: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=1",
          url_consulta_nf: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta",
          mensagem_sefaz: "Autorizado o uso da NF-e",
        },
        calls,
      ),
    });
    const r = await provider.emit("ref1", sale(), settings());
    expect(r).toMatchObject({
      status: "autorizada",
      accessKey: "35261111222333000181650010000000011000000019",
      protocol: "135260000000001",
      danfeUrl: "https://homologacao.focusnfe.com.br/notas_fiscais_consumidor/NFe1.html",
      xmlUrl: "https://homologacao.focusnfe.com.br/arquivos/1.xml",
    });
    expect(calls[0].url).toBe("https://homologacao.focusnfe.com.br/v2/nfce?ref=ref1");
    expect(calls[0].init.method).toBe("POST");
    expect(new Headers(calls[0].init.headers).get("Authorization")).toBe(`Basic ${Buffer.from("tok:").toString("base64")}`);
  });
  it("erro_autorizacao → rejeitada com a mensagem da SEFAZ", async () => {
    const provider = createFocusProvider({ token: "t", environment: "producao", fetchImpl: fakeFetch(201, { status: "erro_autorizacao", status_sefaz: "778", mensagem_sefaz: "Informado NCM inexistente" }) });
    expect(await provider.emit("r", sale(), settings())).toMatchObject({ status: "rejeitada", message: "778 - Informado NCM inexistente" });
  });
  it("4xx de validação → rejeitada com a mensagem do provedor", async () => {
    const provider = createFocusProvider({ token: "t", environment: "homologacao", fetchImpl: fakeFetch(422, { codigo: "empresa_nao_configurada", mensagem: "Empresa não configurada" }) });
    expect(await provider.emit("r", sale(), settings())).toMatchObject({ status: "rejeitada", message: "Empresa não configurada" });
  });
  it("tempo esgotado → erro (pode ter emitido; retry consulta antes)", async () => {
    const provider = createFocusProvider({
      token: "t",
      environment: "homologacao",
      fetchImpl: (async () => {
        throw new DOMException("timeout", "TimeoutError");
      }) as typeof fetch,
    });
    expect(await provider.emit("r", sale(), settings())).toMatchObject({ status: "erro", message: "Provedor fiscal não respondeu. Tente de novo." });
  });
  it("consulta inexistente → null; processando → pendente", async () => {
    const notFound = createFocusProvider({ token: "t", environment: "homologacao", fetchImpl: fakeFetch(404, { codigo: "nfce_nao_encontrada", mensagem: "NFC-e não encontrada." }) });
    expect(await notFound.consult("r")).toBeNull();
    const processing = createFocusProvider({ token: "t", environment: "homologacao", fetchImpl: fakeFetch(200, { status: "processando_autorizacao" }) });
    expect(await processing.consult("r")).toMatchObject({ status: "pendente" });
  });
  it("cancelamento: DELETE com justificativa; ok só quando cancelado", async () => {
    const calls: Call[] = [];
    const ok = createFocusProvider({ token: "t", environment: "homologacao", fetchImpl: fakeFetch(200, { status: "cancelado" }, calls) });
    expect(await ok.cancel("r1", "Cliente desistiu da compra")).toEqual({ ok: true, message: "" });
    expect(calls[0]).toMatchObject({ url: "https://homologacao.focusnfe.com.br/v2/nfce/r1", init: { method: "DELETE", body: JSON.stringify({ justificativa: "Cliente desistiu da compra" }) } });
    const late = createFocusProvider({ token: "t", environment: "homologacao", fetchImpl: fakeFetch(200, { status: "erro_cancelamento", mensagem_sefaz: "Prazo de cancelamento superior ao previsto" }) });
    expect(await late.cancel("r1", "Cliente desistiu da compra")).toEqual({ ok: false, message: "Prazo de cancelamento superior ao previsto" });
  });
});

describe("getFiscalProvider", () => {
  it("só liga com provedor e token", () => {
    expect(getFiscalProvider({})).toBeNull();
    expect(getFiscalProvider({ FISCAL_PROVIDER: "focusnfe" })).toBeNull();
    expect(getFiscalProvider({ FISCAL_PROVIDER: "focusnfe", FOCUS_NFE_TOKEN: "t" })).toMatchObject({ name: "focusnfe", environment: "homologacao" });
    expect(getFiscalProvider({ FISCAL_PROVIDER: "focusnfe", FOCUS_NFE_TOKEN: "t", FOCUS_NFE_ENV: "producao" })).toMatchObject({ environment: "producao" });
    expect(getFiscalProvider({ FISCAL_PROVIDER: "mock" })).toMatchObject({ name: "mock" });
  });
});

describe("createMockProvider", () => {
  it("autoriza com chave de 44 dígitos", async () => {
    const r = await createMockProvider().emit("a1", sale(), settings());
    expect(r.status).toBe("autorizada");
    expect(r.accessKey).toHaveLength(44);
  });
  it("NCM 00000000 → rejeitada", async () => {
    const s = sale();
    s.items[0].fiscal!.ncm = "00000000";
    expect(await createMockProvider().emit("a2", s, settings())).toMatchObject({ status: "rejeitada" });
  });
  it("total 999,99: responde erro, mas a nota existe — consulta mostra autorizada", async () => {
    const m = createMockProvider();
    expect(await m.emit("a3", sale({ totalCents: 99_999 }), settings())).toMatchObject({ status: "erro" });
    expect(await m.consult("a3")).toMatchObject({ status: "autorizada" });
    expect(await m.consult("nao-existe")).toBeNull();
  });
});
