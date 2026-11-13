# QG Ocian — Controle da Lanchonete

Sistema web para anotar a **saída diária de produtos**, fechar o dia com observação e acompanhar o desempenho.

| Aba | Para quê | Login |
|---|---|---|
| **Saída** (`/saida`) | Botões **+ / −** por produto; no fim do dia **Fechar dia** com relação, total e observação | não |
| **Vendas** (`/vendas`) | Em breve: carrinho, pagamento e cupom fiscal | — |
| **Dashboard** (`/dashboard`) | Total por dia, produtos que mais saem, categorias, histórico | sim |
| **Admin** (`/admin`) | Cadastrar, editar, ativar/desativar e remover produtos | sim |

Acompanhamento do desenvolvimento: [docs/PROGRESSO.md](docs/PROGRESSO.md).

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run db:init              # cria coleções e índices no banco da loja
npm run dev                  # http://localhost:3000
```

Outros comandos: `npm test` (testes), `npm run typecheck`, `npm run lint`, `npm run build`.

## Publicar na Vercel

1. **MongoDB Atlas** → *Network Access* → libere `0.0.0.0/0` (a Vercel não tem IP fixo) ou use a integração Vercel ↔ Atlas.
2. Suba o projeto para o GitHub e importe na Vercel (*Add New → Project*). Se o repositório tiver outras pastas, aponte o **Root Directory** para esta pasta.
3. Em *Settings → Environment Variables*, cadastre `MONGODB_URI`, `MONGODB_DB`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `AUTH_SECRET`.
4. Deploy. Confira em `https://SEU-SITE.vercel.app/api/health` → `{"ok":true}`.

## Como funciona

- Next.js (App Router) + TypeScript + Tailwind; MongoDB via Mongoose com conexão reaproveitada (serverless).
- Valores em **centavos**; o "dia" segue o fuso **America/Sao_Paulo**.
- Cada saída guarda cópia de nome/preço do produto: mudar o preço depois não altera dias passados.
- Produto com histórico não é apagado, só desativado.
- `+`/`−` são operações atômicas no banco (dois celulares ao mesmo tempo não perdem contagem).
