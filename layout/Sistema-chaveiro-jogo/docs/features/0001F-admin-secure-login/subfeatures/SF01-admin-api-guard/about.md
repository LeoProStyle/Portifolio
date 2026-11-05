---
id: 0001F-SF01
type: feature
slug: admin-api-guard
status: pending
branch: feature/0001F-admin-secure-login
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [auth, admin, api, middleware]
---

# SF01 — Admin API Guard

## TL;DR
Subfeature de 0001F que coloca uma verificação de sessão no servidor em todas as rotas `/api/admin/*`. Hoje essas rotas aceitam chamadas anônimas. Depois dela, sem sessão de admin a resposta é 401.

## TOC
- [Objective](#objective)
- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [Relations](#relations)
- [Observations](#observations)
- [References](#references)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

**Serves the feature objective by:** garantir que só o admin autenticado adiciona, edita ou remove jogos e cartuchos, bloqueando o acesso direto à API admin.

## Problem
As rotas admin não verificam quem chama.
- `middleware.ts:9-11` tem `matcher: []`, então o middleware não roda.
- Nenhum handler em `app/api/admin/**` chama `auth()`; `auth` só é importado pela rota do NextAuth (`app/api/auth/[...nextauth]/route.ts:1`).
- `/admin` só é protegido no browser, por `useSession` (`app/admin/page.tsx:14-21`).
- Sinal observável: qualquer `curl` para `/api/admin/games` cria, edita ou apaga jogos.

## Users

| role | goal | pain |
|---|---|---|
| Admin (dono do RetroKey) | Gerenciar jogos e cartuchos sem que terceiros alterem o catálogo | Hoje qualquer pessoa altera o catálogo pela API |
| Jogador | Usar o cartucho NFC e jogar | Catálogo pode ser adulterado ou apagado por terceiros |

## Requirements
- **RF01:** O sistema responde 401 com `{error}` a qualquer chamada a `/api/admin/*` sem sessão válida.
- **RF02:** O sistema responde 403 com `{error}` a uma sessão válida sem `role: admin`.
- **RF03:** O middleware redireciona requisições de página a `/admin` sem sessão para `/login?callbackUrl=/admin`.
- **RF04:** As abas de jogos e cartuchos mostram que a sessão expirou e levam ao login quando a API responde 401 ou 403.
- **RN01:** A verificação no handler é a barreira de segurança; o middleware só redireciona páginas.
- **RN02:** O matcher do middleware não cobre `/api/auth/*` nem `/login`.
- **RN03:** A verificação de sessão não depende do MongoDB, para continuar funcionando no fallback em memória.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Guard em cada handler + middleware só para páginas | Next 14.2.15 é anterior ao patch do bypass de middleware CVE-2025-29927 (14.2.25); o handler resiste a esse bypass | Só middleware — contornável nesta versão |

## Scope
### Includes
- Guard nas 10 rotas admin (games, games/[id], cartridges, cartridges/[id]).
- Matcher do middleware para `/admin/:path*`.
- Tratamento de 401/403 em `GamesTab` e `CartridgesTab`.

### Does NOT Include
- Endurecer o login (hash, bloqueio, sessão de 8h) — é SF02.
- Proteger `/api/rom/[slug]` com sessão — o emulador carrega a ROM sem login.
- Atualizar o Next para 14.2.25+ — o guard no handler não depende do middleware.

## Success Metrics

| metric | target | source |
|---|---|---|
| Chamadas a `/api/admin/*` sem sessão | 100% recebem 401 | testes do guard (`tests/`) e E2E em `e2e/` (specs `@playwright/test` criadas pelo `/add-build` via qa-pipeline) |
| Chamadas com sessão de admin | Mesmo comportamento de hoje | E2E `e2e/admin.qa.spec.ts` |
| GET `/admin` sem sessão | Redireciona para `/login?callbackUrl=/admin` | E2E `e2e/admin.qa.spec.ts` |
| Sessão válida sem `role: admin` | 403 | testes do guard |

## Relations
- part_of [[0001F]]

## Observations
- [constraint] middleware roda no edge runtime: não pode importar `node:crypto` nem o driver `mongodb` #auth
- [constraint] `components/admin/CartridgesTab.tsx` também chama `/api/admin/games` (route_map) #admin

## References
- {{doc:0001F}}
- `docs/features/0001F-admin-secure-login/discovery.md`
- `docs/code-quality-review.md`
