# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

QG Ocian — sistema web de controle de uma lanchonete (Next.js 15 App Router + React 19 + TypeScript, Tailwind v4, MongoDB Atlas via Mongoose 9, Zod 4, Recharts 3). Deploy alvo: Vercel (serverless). UI, mensagens de erro e documentação em **pt-BR**.

**Antes de qualquer tarefa, leia [docs/PROGRESSO.md](docs/PROGRESSO.md); depois de cada tarefa, atualize-o.** Marque `[x]` só quando a tarefa estiver feita **e verificada** (build/teste/tela conferida).

## Comandos

```bash
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest run (tests/**/*.test.ts, ambiente node)
npx vitest run tests/core.test.ts -t "money"   # um arquivo / um teste pelo nome
npm run db:init      # cria coleções e índices (lê .env.local via tsx --env-file)
```

Variáveis em `.env.local` (modelo em `.env.example`): `MONGODB_URI`, `MONGODB_DB`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`, `SIST_USERNAME`/`SIST_PASSWORD`, `AUTH_SECRET`. Alias `@/` aponta para a raiz do projeto (também no vitest).

## Arquitetura

**Telas:** cada `app/*/page.tsx` é um server component fino que só define `metadata` e renderiza um client component de `components/<área>/` (ex.: `SaidaBoard`, `Dashboard`, `ProductsAdmin`). Os client components buscam dados nas rotas `/api/*` via `lib/client.ts` (`api`/`post`, que lançam `HttpError` com a mensagem `error` da API).

**Rotas de API** (`app/api/**/route.ts`) seguem sempre o mesmo padrão de [lib/api.ts](lib/api.ts):
- Envolver o handler em `handler(...)`, que converte `ApiError` → status próprio, `ZodError` → 400, erro Mongo 11000 → 409 e o resto → 500.
- Chamar `requireSession()` ou `requireAdmin()` no início (defesa em profundidade além do middleware).
- Validar o corpo com schemas de [lib/validation.ts](lib/validation.ts) e responder com `json(...)` (já põe `Cache-Control: no-store`).
- A regra de negócio fica em `lib/` (`register.ts` para a Saída, `stats.ts` para o Dashboard), não na rota.

**Autenticação** ([lib/auth.ts](lib/auth.ts), [middleware.ts](middleware.ts)): login por usuário/senha do env, sessão em JWT HS256 (`jose`) no cookie httpOnly `qg_session`. Dois papéis: `staff` (SIST_*) acessa Saída/Vendas; `admin` (ADMIN_*) acessa tudo. O middleware protege todo o site, exceto `/login`, `/api/auth/*`, `/api/health` e estáticos. Rotas só do dono estão em `ADMIN_PREFIXES` em `lib/auth.ts` — ao criar página/API restrita ao dono, adicione o prefixo lá **e** use `requireAdmin()` na rota.

**Dados** (`models/`): `Product` e `DailyRegister` (um documento por dia, chave `date` única). Conexão em cache global (`lib/db.ts`) — sempre `await connectDB()` antes de usar os models. Documentos Mongo nunca vão direto para o cliente: converta com `lib/serializers.ts` para os DTOs de `lib/types.ts`.

**Financeiro** (`/admin/fechamentos|despesas|cupons`, APIs em `/api/finance/*`): models `CardClosing`, `Expense`, `Invoice`; consultas e planilhas em `lib/finance-data.ts`, regras puras em `lib/finance.ts`. Excel via `lib/xlsx.ts` (`buildSheet`, sempre com linha TOTAL). O XML dos cupons (`lib/fiscal.ts` → `buildInvoiceXml`) precisa manter **a mesma sequência de tags** de `docs/ref/*.xml`. Isso é coberto por `tests/finance.test.ts`, então não mude a estrutura sem atualizar a referência. Rotas `route.ts` só exportam handlers (GET/POST/...); helpers vão para `lib/`.

**Vendas / caixa** (`/vendas`, `/vendas/config`, `/vendas/comprovante/[id]`, APIs em `/api/vendas/*`): models `Sale`, `Counter` (`nextSeq`), `FiscalSettings` (doc único `_id: "default"`), `ProductFiscal` (NCM etc. por produto — o model `Product` não tem dados fiscais de propósito). Regras puras em `lib/sales-rules.ts` (lançam `SaleError`), banco + provedor em `lib/sales.ts`. NFC-e via `lib/fiscal-provider/` (`getFiscalProvider()` lê `FISCAL_PROVIDER` = vazio | `focusnfe` | `mock`; `FOCUS_NFE_TOKEN`, `FOCUS_NFE_ENV`). Use `FISCAL_PROVIDER=mock` em testes/local — nunca em produção. `/vendas/config` e `/api/vendas/config` estão em `ADMIN_PREFIXES`. `requireSession()` devolve o papel (`staff`/`admin`).

## Regras de domínio que não podem quebrar

- **Dinheiro em centavos (inteiro)** em todo lugar; formatação/parse via `lib/money.ts` (`formatBRL`, `parseBRL`).
- **"Dia" = fuso America/Sao_Paulo**, guardado como string `YYYY-MM-DD`. Use `todayKey()`/`addDays()` de `lib/date.ts`; nunca `new Date().toISOString().slice(0,10)`.
- **Snapshot no histórico:** cada item de `DailyRegister` copia nome/categoria/emoji/preço do produto; editar um produto não altera dias passados.
- **Concorrência:** `+`/`−` usam `$inc` atômico com filtros (`status: "open"`, `qty > 0`) — nunca leia-modifique-grave o array de itens. `closeDay` usa trava otimista por `updatedAt` e responde 409 se o dia mudou.
- Dia fechado não aceita alterações (409); só o admin reabre (`/api/saida/reopen`). Não se anota em dias futuros.
- Produto com histórico não é apagado, só desativado.
- Vendas tem coleção própria (`sales`), separada de `dailyregisters`: vender **não** mexe na Saída nem no Dashboard.
- **Venda nunca confia no navegador:** o corpo traz só `productId` + `qty`; preço/nome vêm do banco. O mesmo `clientRef` devolve a mesma venda (clique duplo).
- **NFC-e nunca em dobro:** a `ref` no provedor é o id da venda; "tentar de novo" (`retryFiscal`) consulta o provedor antes de reenviar. Cancelar NFC-e exige motivo ≥ 15 caracteres (SEFAZ aceita até 30 min após a emissão). Certificado A1 e CSC ficam no painel do provedor, nunca no sistema.

## Fluxo de trabalho

O repositório tem o pipeline ADD instalado (`.claude/commands/add-*`, `.codeadd/`) — comandos como `/add-new`, `/add-plan`, `/add-build`, `/add-review`, `/add-hotfix`.
