# QG Ocian — Controle de Produtos da Lanchonete

> **Documento vivo de acompanhamento.** Ler ANTES de qualquer tarefa e atualizar DEPOIS de cada uma.
> Regra: marcar `[x]` só quando a tarefa estiver feita **e verificada** (build/teste/tela conferida).

**Última atualização:** 2026-11-13
**Fase atual:** Fases 1–4 concluídas localmente · aguardando Fase 6 (publicar na Vercel)
**Próximo passo:** cadastrar os produtos reais no Admin → publicar na Vercel (Fase 6) → depois Vendas (Fase 5)

---

## 1. Visão geral

| Área | Quem usa | O que faz |
|---|---|---|
| **Saída de produtos** (`/saida`) | Dono/atendente | Lista os produtos com botões **+ / −** para anotar o que sai; no fim do dia, **Fechar dia** com observação, relação do que saiu e total. *(As vendas reais são feitas na maquininha.)* |
| **Vendas** (`/vendas`) | Caixa | **Futuro (Fase 5):** venda com carrinho e pagamento, impressão de cupom fiscal. Hoje mostra página "em breve" |
| **Admin** (`/admin`) | Dono | Cadastrar, editar, ativar/desativar e remover produtos |
| **Dashboard** (`/dashboard`) | Dono | Desempenho por dia e produtos mais vendidos |

> **Decisão (2026-11-13):** Vendas virou uma fase própria (Fase 5). Motivo: cupom fiscal exige integração com SEFAZ (NFC-e) e impressora — escopo grande que não deve atrasar a Saída de produtos. O modelo de dados já separa as duas coisas (`dailyregisters` ≠ futura `sales`).

## 2. Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript + React 19** | Deploy nativo na Vercel, front e API no mesmo projeto |
| Estilo | **Tailwind CSS v4** com tokens em `app/globals.css` (claro/escuro automático) | UI moderna e consistente |
| Banco | **MongoDB Atlas** via **Mongoose 9** | Conexão em cache global para funções serverless (`lib/db.ts`) |
| Validação | **Zod 4** (`lib/validation.ts`) | Mesmas regras em todas as rotas |
| Gráficos | **Recharts 3** | Cor `--chart #ea580c` validada (dataviz) no claro e no escuro |
| Login | Usuário+senha do env + JWT HS256 em cookie httpOnly (`jose`), com papel `staff` (SIST_*) ou `admin` (ADMIN_*) | Todo o sistema exige login; Admin/Dashboard só o dono |
| Dinheiro | **Centavos (inteiro)** | Sem erro de arredondamento |
| "Dia" | Fuso **America/Sao_Paulo**, chave `YYYY-MM-DD` | O dia não vira às 21h (meia-noite UTC) |
| Preço no histórico | Cada item do dia guarda **cópia** de nome/categoria/emoji/preço | Mudar preço não altera dias passados (testado) |
| Concorrência | `+`/`−` com `$inc` atômico, nunca < 0 | Dois aparelhos ao mesmo tempo não perdem contagem (testado com 5 cliques paralelos) |

### Variáveis de ambiente (`.env.local` e Vercel) — modelo em `.env.example`

```
MONGODB_URI=                    # já preenchida no .env.local
MONGODB_DB=Lanchonete-QgOcian   # banco exclusivo da loja (criado em 2026-11-13)
ADMIN_USERNAME=
ADMIN_PASSWORD=
SIST_USERNAME=                  # login do sistema (funcionário): Saída e Vendas
SIST_PASSWORD=
AUTH_SECRET=                    # ⚠️ hoje tem 8 caracteres — trocar por 32+ antes de publicar
```

## 3. Modelo de dados (banco `Lanchonete-QgOcian`)

**`products`** — `name` (único, ignora maiúscula/acento), `category`, `priceCents`, `emoji`, `active`, `sortOrder`, timestamps

**`dailyregisters`** (um por dia) — `date "YYYY-MM-DD"` (único), `status open|closed`, `items[{productId, name, category, emoji, priceCents, qty}]`, `totalCents`, `totalItems`, `notes`, `closedAt`
- Dia aberto: totais calculados na hora. Ao fechar: itens zerados removidos e totais congelados.
- Dia fechado não aceita + / − (409). Só o admin reabre.
- Remover produto: se já teve saída → só **desativa**; senão apaga de vez.

## 4. Estrutura de pastas

```
app/
  saida/ vendas/ dashboard/ admin/ login/     # páginas
  api/health                                  # GET ping do banco
  api/auth/login|logout                       # sessão do admin
  api/products, api/products/[id]             # CRUD (admin)
  api/saida (GET), saida/item, saida/close    # aba Saída (login staff ou admin)
  api/saida/reopen                            # reabrir dia (admin)
  api/stats                                   # dashboard (admin)
components/  AppHeader, Modal, Toaster, saida/*, admin/*, dashboard/*
lib/  db, auth, credentials, api, client, date, money, register, stats, serializers, types, validation
models/  Product, DailyRegister
middleware.ts        # protege /admin, /dashboard e APIs de admin
scripts/init-db.ts   # npm run db:init (coleções + índices)
tests/core.test.ts   # vitest
```

---

## 5. Fases e tarefas

### Fase 1 — Estrutura (Vercel + MongoDB) ✅
- [x] 1.1 Projeto Next.js + TypeScript + Tailwind + ESLint
- [x] 1.2 mongoose, zod, jose, recharts, lucide-react, vitest
- [x] 1.3 `lib/db.ts` — conexão com cache global (serverless)
- [x] 1.4 Models `Product` e `DailyRegister` com índices
- [x] 1.5 `money.ts` e `date.ts` (com testes)
- [x] 1.6 `/api/health` (verificado: ok)
- [x] 1.7 `.env.example` + README com passo a passo Atlas/Vercel
- [x] 1.8 Layout base com abas Saída / Vendas (breve) / Dashboard / Admin
- [x] 1.9 `npm run build` ✅ · banco `Lanchonete-QgOcian` criado com `npm run db:init` ✅

### Fase 2 — Admin de produtos ✅
- [x] 2.1 Login (usuário+senha) + middleware + checagem dupla nas rotas
- [x] 2.2 API CRUD com Zod; nome duplicado → 409
- [x] 2.3 Listagem por categoria, busca, filtro Todos/Ativos/Inativos
- [x] 2.4 Formulário criar/editar (nome, categoria com sugestões, preço em R$, ícone, ordem, ativo)
- [x] 2.5 Ativar/desativar com interruptor; remover com confirmação (desativa se tiver histórico)
- [x] 2.6 Testado na API (e2e) e na tela (cadastro do "Croissant" conferido)

### Fase 3 — Saída de produtos ✅
- [x] 3.1 API obter dia (hoje ou data anterior)
- [x] 3.2 + / − atômico, nunca negativo
- [x] 3.3 Cards grandes por categoria, toque no produto = +1, busca e filtro por categoria
- [x] 3.4 ~~Total em tempo real~~ → **alterado a pedido:** durante o dia só aparece a quantidade de cada produto e um único botão **Fechar dia** fixo no rodapé; relação, itens e total aparecem apenas no modal de fechamento
- [x] 3.5 Atualização otimista + aviso e recarga se falhar
- [x] 3.6 **Fechar dia**: relação + total + observação + confirmação
- [x] 3.7 Dia fechado vira relatório; aviso de dias anteriores que ficaram abertos; reabrir (admin)
- [x] 3.8 Verificado em 390px (celular) e 1280px

### Fase 4 — Dashboard ✅
- [x] 4.1 `/api/stats` (7 / 30 / 90 dias) + comparação com período anterior
- [x] 4.2 Cartões: total, itens, média por dia, dias com saída
- [x] 4.3 Gráfico de barras do valor por dia (com tooltip)
- [x] 4.4 Ranking "Mais saem" (quantidade ou valor) + tabela por categoria
- [x] 4.5 Histórico de dias com relação e observação expansíveis
- [x] 4.6 Verificado na tela

### Fase 5 — Vendas + cupom (futuro)
- [ ] 5.1 Model `Sale` (itens, forma de pagamento, total, status)
- [ ] 5.2 Tela de venda: carrinho, forma de pagamento, finalizar
- [ ] 5.3 Comprovante não fiscal na impressora térmica
- [ ] 5.4 Cupom fiscal NFC-e (definir provedor: Focus NFe, NFe.io etc. — exige certificado digital e CSC da SEFAZ)
- [ ] 5.5 Vendas no dashboard

### Fase 6 — Publicação
- [ ] 6.0 Trocar `AUTH_SECRET` por chave de 32+ caracteres
- [ ] 6.1 Projeto na Vercel (Root Directory = esta pasta) + variáveis de ambiente
- [ ] 6.2 Atlas → Network Access liberando a Vercel
- [ ] 6.3 Deploy + `/api/health` + teste ponta a ponta em produção

---

## 6. Diário de desenvolvimento

| Data | O que foi feito | Observações |
|---|---|---|
| 2026-11-13 | Documento criado; stack e modelo de dados definidos | Pasta do projeto estava vazia |
| 2026-11-13 | Usuário pediu separar Vendas (futuro, cupom fiscal) de Saída de produtos | Vendas → Fase 5; aba "em breve" já na navegação |
| 2026-11-13 | Fases 1–4 implementadas | 19 testes unitários ✅ · 24 checagens e2e da API ✅ · lint ✅ · build ✅ |
| 2026-11-13 | Verificação visual (celular e desktop) | Corrigidos: data "13 De Novembro" → "13 de novembro"; abas cortadas no celular; filtros quebrando linha no Admin |
| 2026-11-13 | Testes rodaram num banco temporário `QgOcian-teste-e2e`, apagado no fim | Banco da loja ficou vazio, pronto para os produtos reais |
| 2026-11-13 | Saída: removidos painel "Relação do dia" e totais da barra; fica só o botão **Fechar dia**; somatórias só no modal | Pedido do usuário. Verificado em 390px e 1280px. Commits ficam por conta do usuário |
| 2026-11-13 | **Bug na Vercel:** sistema abria sem login (Saída era livre por projeto; `SIST_*` nunca era usado). Agora o middleware protege tudo; login `SIST_*` = funcionário (Saída/Vendas), `ADMIN_*` = dono (tudo); botão Sair no cabeçalho | 20 testes ✅ · lint ✅ · build ✅ · curl ponta a ponta (sem login 307/401, funcionário 403 no Admin, dono 200) ✅. Precisa cadastrar `SIST_USERNAME`/`SIST_PASSWORD` na Vercel |

## 7. Pendências / dúvidas em aberto
- ⚠️ `AUTH_SECRET` atual tem só 8 caracteres — gerar uma de 32+ antes de publicar (comando no `.env.example`).
- Vendas/cupom: provedor de NFC-e e modelo da impressora — definir na Fase 5.
- Ideias futuras (não pedidas): exportar relação do dia em PDF/WhatsApp; estoque com aviso de produto acabando.

## 8. Como verificar
```
npm test            # unitários
npm run lint        # lint
npm run build       # build de produção
npm run db:init     # (re)cria índices no banco
GET /api/health     # {"ok":true,"db":"Lanchonete-QgOcian"}
```
