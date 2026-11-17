# Fase 5 — Vendas (caixa + cupom não fiscal, estrutura para NFC-e)

**Data:** 2026-11-17 · **Status:** aguardando aprovação

## 1. Intenção

O sistema está em produção com os produtos reais cadastrados. Agora a aba **Vendas** (`/vendas`, hoje "em breve")
vira um **caixa**: o atendente monta o pedido tocando nos produtos, recebe o pagamento e imprime o comprovante.

Duas partes:
1. **Venda com cupom não fiscal** — funciona já.
2. **Cupom fiscal (NFC-e)** — estrutura pronta e testada contra um provedor simulado; para ligar de verdade o dono
   só preenche os dados (token do provedor + dados fiscais), sem mexer em código.

No caixa há um seletor **Não fiscal | Fiscal** que decide qual cupom sai.

## 2. Objetivos, não objetivos, anti-objetivos

**Objetivos**
- Vender rápido em celular (390px) e computador (1280px): toque no produto = +1 no pedido.
- Pagamento em uma ou mais formas (dinheiro com troco, PIX, débito, crédito, vale).
- Comprovante não fiscal em bobina **80 mm** impresso pelo navegador.
- NFC-e via provedor (Focus NFe), autorizada pela SEFAZ, ativável só por configuração.
- Lista das vendas do dia com reimpressão e cancelamento.

**Não objetivos (v1)**
- **Nada muda nas outras abas** (Saída, Admin, Dashboard, Financeiro). Vendas não alimenta a Saída nem o Dashboard.
- Sem estoque, sem desconto, sem cadastro de clientes, sem gaveta/TEF integrada.
- Sem emissão direta na SEFAZ com certificado no servidor (descartada — ver §4).

**Anti-objetivos (seria falha mesmo "funcionando")**
- Atendente achar que emitiu nota fiscal quando não emitiu → o modo Fiscal fica **travado** enquanto não configurado,
  e toda venda mostra claramente se é fiscal e qual o status.
- Venda duplicada por clique duplo ou rede lenta.
- Preço vindo do navegador: o servidor sempre recalcula pelo cadastro.
- Certificado digital ou senha guardados neste sistema.

## 3. Restrições

- Regras do `CLAUDE.md`: centavos inteiros, dia em America/Sao_Paulo (`todayKey()`), rotas com `handler` +
  `requireSession/requireAdmin` + Zod, regra de negócio em `lib/`, DTOs via `lib/serializers.ts`.
- Vercel serverless: chamadas ao provedor com tempo limite (8 s) e tratamento de "não sei se emitiu".
- Coleção própria `sales`, separada de `dailyregisters` (já decidido no projeto).

## 4. Abordagens consideradas

| | Como | Prós | Contras |
|---|---|---|---|
| A) Emissão direta | Sistema assina XML com certificado A1 e fala com o webservice da SEFAZ-SP | Sem mensalidade, sem terceiro | Certificado + senha na Vercel (risco de vazamento = assinatura em nome da empresa); acompanhar Notas Técnicas no código; contingência à parte; não testável sem certificado |
| **B) Provedor** ✅ | Sistema envia a venda ao provedor, que assina com o certificado do cliente e transmite | Token revogável em vez de certificado; provedor acompanha a SEFAZ e a contingência; sandbox para testar; HTTP simples | Mensalidade; depende do provedor (mitigado: provedor isolado atrás de uma interface) |

**Escolhida: B**, pelo usuário, depois de comparar segurança e manutenção. Primeiro provedor: **Focus NFe** (escolha do
Claude: API REST documentada para NFC-e, sandbox gratuito). Ambas resultam em NFC-e autorizada pela SEFAZ no CNPJ da loja.

## 5. Decidido com o usuário

- Só a aba Vendas muda.
- Seletor Não fiscal / Fiscal no caixa.
- Caminho B (provedor). "Deixar pronto" = ao usar, só preencher dados de funcionamento e autenticação.
- Dados fiscais (empresa e produtos) cadastrados numa tela **Configuração fiscal dentro de Vendas**, só do dono;
  o Admin de produtos fica intocado.

## 6. Design

### 6.1 Telas

```
/vendas                  Caixa  |  Vendas do dia            (staff e admin)
/vendas/config           Configuração fiscal               (só admin)
/vendas/comprovante/[id] Comprovante 80 mm (página de impressão)
```

**Caixa**
```
┌ Vendas ─────────────────────────────────────────────┐
│ [Caixa] [Vendas do dia]               ⚙ Config (dono)│
│ [🔍 buscar]   Todos | Lanches | Bebidas | Doces      │
│ ┌──────┐┌──────┐┌──────┐        │ Pedido            │
│ │🍔 X  ││🥤 Suco││☕ Café│        │ 2× X-Burguer 30,00│  − / + / remover
│ └──────┘└──────┘└──────┘        │ 1× Café       5,00│
│                                  │ Total       35,00 │
│                                  │ (•) Não fiscal    │
│                                  │ ( ) Fiscal 🔒      │
│                                  │ [ Pagamento → ]   │
└─────────────────────────────────────────────────────┘
```
- Cards de produtos ativos agrupados por categoria (mesma ordem/visual da Saída; reaproveitar `NameTooltip`).
- No celular o pedido vira barra fixa no rodapé ("3 itens · R$ 35,00 · Ver pedido").
- Seletor de cupom: "Fiscal" desabilitado com o motivo ("Cupom fiscal não configurado" / "Café sem NCM") quando não
  está pronto. Último modo usado lembrado no `localStorage`.
- Modo Fiscal mostra campo opcional **CPF/CNPJ na nota** (Nota Fiscal Paulista).

**Pagamento (modal)**
- Botões das formas: Dinheiro (01), PIX (17), Débito (04), Crédito (03), Vale refeição (11), Vale alimentação (10).
  Reusar `PAYMENT_METHODS` de `lib/fiscal.ts`.
- Uma forma por padrão com o valor total; "+ outra forma" para dividir. Só finaliza quando a soma = total
  (dinheiro pode passar do total → **troco** calculado e exibido; só o dinheiro gera troco).
- "Finalizar" → cria a venda → abre o comprovante (não fiscal) ou o DANFE NFC-e (fiscal) e limpa o carrinho.

**Vendas do dia**
- Lista: número, hora, itens, total, formas, tipo (Não fiscal / Fiscal + status), botões Reimprimir e Cancelar.
- Rodapé com total do dia por forma de pagamento (só das vendas não canceladas). Seletor de data para dias anteriores.
- Fiscal com status `erro`/`rejeitada`: botão **Tentar de novo** e mensagem do provedor.

**Configuração fiscal (admin)**
- *Status do provedor*: "Conectado — homologação/produção" ou "Não configurado (faltam FOCUS_NFE_TOKEN…)".
  Lê só se as variáveis existem; nunca mostra o token.
- *Empresa*: CNPJ, razão social, nome fantasia, IE, regime (CRT), endereço, telefone, mensagem de rodapé do
  comprovante. O cabeçalho do comprovante **não fiscal** também usa estes dados (sem eles, usa "QG Ocian").
- *Padrões*: CFOP (5102), CSOSN/CST (102 se Simples), origem (0), unidade (UN).
- *Produtos*: tabela de todos os produtos com NCM, CFOP, CEST, unidade — editável em linha; indicador de quem falta
  NCM. Campos vazios usam os padrões (NCM não tem padrão: é obrigatório por produto para vender no fiscal).

**Comprovante não fiscal (80 mm)**
```
        QG OCIAN
  CNPJ 00.000.000/0001-00
  Rua X, 123 – Bairro
--------------------------------
 Venda nº 000123  17/11/2026 14:32
--------------------------------
 2 x X-Burguer        30,00
 1 x Café              5,00
--------------------------------
 TOTAL             R$ 35,00
 Dinheiro             50,00
 Troco                15,00
--------------------------------
 *** NÃO É DOCUMENTO FISCAL ***
     Obrigado, volte sempre!
```
Página com `@page { size: 80mm auto; margin: 0 }`, abre e chama `window.print()`. Cancelada → tarja "CANCELADA".
Fiscal → abrir o **DANFE NFC-e do provedor** (`caminho_danfe`), que já segue o layout exigido.

### 6.2 Dados

**`sales`** (`models/Sale.ts`)
```
number         Int, único, sequencial (coleção counters, $inc atômico)
clientRef      String, único — gerado no navegador por venda (idempotência contra clique duplo)
date           "YYYY-MM-DD" (todayKey) · createdAt/updatedAt
kind           "nao_fiscal" | "fiscal"
items[]        productId, name, category, emoji, unitCents, qty, totalCents   (snapshot)
               + fiscal snapshot quando kind=fiscal: ncm, cfop, cest, unit, origin, taxCode
totalCents
payments[]     method (tPag), amountCents
receivedCents  (dinheiro entregue) · changeCents (troco)
customerDoc    CPF/CNPJ opcional (só fiscal)
status         "concluida" | "cancelada" · cancelReason · canceledAt
createdBy      "staff" | "admin"
fiscal?        status "pendente"|"autorizada"|"rejeitada"|"erro"|"cancelada", provider, ref,
               environment, accessKey, number, series, protocol, qrCodeUrl, consultUrl,
               xmlUrl, danfeUrl, message, attempts, lastAttemptAt
```
Índices: `number` único, `clientRef` único, `{date:1, number:1}`, `{"fiscal.status":1}`.

**`fiscalsettings`** (documento único, `models/FiscalSettings.ts`) — empresa + padrões da §6.1.

**`productfiscals`** (`models/ProductFiscal.ts`) — `productId` único, `ncm`, `cfop`, `cest`, `unit`, `origin`,
`taxCode`. Coleção separada para não tocar no model `Product` nem no Admin.

**`counters`** — `{ _id: "sale", seq }` para o número da venda.

`scripts/init-db.ts` cria as coleções e índices novos.

### 6.3 API (`app/api/vendas/**`, tudo `requireSession` salvo indicação)

| Rota | Faz |
|---|---|
| `GET /api/vendas/catalog` | Produtos ativos + prontidão fiscal (provedor configurado? empresa ok? produtos sem NCM) |
| `POST /api/vendas` | Cria venda. Corpo: `clientRef`, `kind`, `items[{productId, qty}]`, `payments[]`, `receivedCents?`, `customerDoc?`. Preços/nomes do banco; valida soma; repetir o mesmo `clientRef` devolve a venda existente |
| `GET /api/vendas?date=` | Vendas do dia + totais por forma |
| `GET /api/vendas/[id]` | Uma venda (comprovante) |
| `POST /api/vendas/[id]/cancel` | Cancela (motivo obrigatório; fiscal ≥ 15 caracteres, exigência da SEFAZ). Só vendas de hoje para staff; admin qualquer data |
| `POST /api/vendas/[id]/fiscal/retry` | Consulta o provedor pela `ref`; se não existe lá, reenvia |
| `GET/PUT /api/vendas/config` | **requireAdmin** — empresa, padrões, fiscal dos produtos |

`/vendas/config` e `/api/vendas/config` entram em `ADMIN_PREFIXES` (`lib/auth.ts`).
Regras em `lib/sales.ts` (criar, totais, troco, cancelar) e `lib/fiscal-provider/*`.

### 6.4 Camada do provedor

```
lib/fiscal-provider/
  types.ts      interface FiscalProvider { emit(input), consult(ref), cancel(ref, reason) } + FiscalResult
  index.ts      getFiscalProvider(): lê FISCAL_PROVIDER; null se não configurado (fiscal travado)
  focusnfe.ts   implementação Focus NFe (REST v2, auth básica com o token)
  mock.ts       provedor simulado (autoriza/rejeita por regra) — testes e ambiente local
  payload.ts    função pura venda + configurações → corpo NFC-e da Focus (testada)
```
Variáveis (`.env.example` e Vercel):
```
FISCAL_PROVIDER=        # vazio = fiscal desligado · "focusnfe" · "mock" (só testes/local)
FOCUS_NFE_TOKEN=
FOCUS_NFE_ENV=homologacao   # ou producao
```
Certificado A1 e CSC ficam **no painel da Focus**, nunca aqui. `ref` da Focus = id da venda (idempotente no provedor).
Numeração/série da NFC-e: controlada pelo provedor; o sistema guarda o que voltar.

**Fluxo fiscal ao finalizar**
1. Salva a venda com `fiscal.status = "pendente"` (a venda existe mesmo se o provedor falhar).
2. Chama `emit` com tempo limite de 8 s.
3. `autorizado` → grava chave/protocolo/QR/URLs → abre DANFE.
   `rejeitado` → grava mensagem; tela mostra o motivo e oferece **Tentar de novo** (após corrigir a config) ou **Cancelar venda**.
   Tempo esgotado/rede → `erro`; **Tentar de novo** primeiro consulta pela `ref` para não emitir em dobro.
4. Cancelar venda fiscal autorizada → `cancel` no provedor; só marca cancelada se o provedor confirmar
   (fora do prazo da SEFAZ o provedor recusa e a mensagem aparece).

**Tributação:** CRT 1/4 (Simples/MEI) → CSOSN do produto ou padrão 102; CRT 3 → CST padrão 00 com valores zerados.
Ajuste fino de impostos é com o contador — fica configurável, não fixo no código.

### 6.5 Testes / verificação
- Unitários (`tests/sales.test.ts`): totais, troco, soma de pagamentos, snapshot, idempotência por `clientRef`,
  prontidão fiscal, `payload.ts` (campos obrigatórios, CSOSN x CST, CPF na nota), mapeamento de respostas da Focus.
- e2e da API em banco temporário com `FISCAL_PROVIDER=mock`: venda não fiscal, fiscal autorizada, rejeitada,
  erro + retry sem duplicar, cancelamentos, staff barrado em `/vendas/config`.
- Telas em 390px e 1280px; impressão conferida na pré-visualização 80 mm.
- Ligar de verdade (feito pelo dono depois): conta Focus → certificado + CSC no painel → token de **homologação**
  na Vercel → emitir uma nota de teste → trocar para produção.

## 7. Escolhas do Claude (corrigíveis)
- Focus NFe como primeiro provedor; DANFE fiscal = o do provedor.
- Impressão pelo navegador em layout 80 mm (qualquer impressora térmica instalada).
- Pagamento dividido permitido; troco só no dinheiro.
- Número de venda sequencial global.
- CPF/CNPJ na nota opcional no modo fiscal.
- Cancelamento: staff só no mesmo dia; admin qualquer data.
- Sem desconto na v1.

## 8. Deixado para quem construir
- Visual exato dos componentes (seguir tokens de `app/globals.css` e o padrão da Saída).
- Organização interna dos componentes em `components/vendas/`.
- Mensagens de erro em pt-BR para cada código de rejeição comum.
