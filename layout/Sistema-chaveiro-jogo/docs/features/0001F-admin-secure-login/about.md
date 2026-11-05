---
id: 0001F
type: feature
slug: admin-secure-login
status: draft
branch: feature/0001F-admin-secure-login
created: 2026-11-05
updated: 2026-11-05
related: []
tags: [auth, admin, security, login, audit]
intent: none
---

# Admin Secure Login

## TL;DR
Feature epic que fecha o acesso anônimo à área admin do RetroKey e endurece o login contra fraude. Hoje a API `/api/admin/*` não verifica sessão, o login aceita senha padrão e tentativas ilimitadas, e um `romPath` forjado lê arquivos do servidor. A entrega tem quatro subfeatures: guard da API (SF01), login endurecido (SF02), trilha de auditoria (SF03) e contenção do caminho de ROM (SF04).

## TOC
- [Objective](#objective)
- [Problem](#problem)
- [Users](#users)
- [Decisions](#decisions)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [Relations](#relations)
- [Observations](#observations)
- [References](#references)

## Objective
Só o administrador autenticado consegue adicionar, editar ou remover jogos e cartuchos, e o login do admin resiste a tentativas de fraude (força bruta, senha padrão, acesso direto à API). `[from conversation, no brainstorm]`

**How each subfeature serves it:**
- SF01 — bloqueia o acesso direto à API admin sem sessão de admin.
- SF02 — faz o login resistir a força bruta e a senha padrão.
- SF03 — permite investigar depois um login suspeito ou uma alteração do catálogo.
- SF04 — limita o que uma sessão de admin roubada ou abusada consegue ler do servidor pela API (ex.: `.env`).

## Problem
A área admin está aberta a qualquer pessoa que chame a API diretamente.
- **Afetados:** o dono do RetroKey, que gerencia o catálogo, e os jogadores, que dependem desse catálogo.
- **API sem verificação:** `middleware.ts:9-11` tem `matcher: []`; nenhum handler em `app/api/admin/**` chama `auth()`; `/admin` só checa sessão no browser (`app/admin/page.tsx:14-21`).
- **Login fraco:** padrão `admin`/`admin123` sem env (`lib/auth-config.ts:7-8`); `AUTH_SECRET` literal no código (`auth.ts:7`); comparação `===` (`auth.ts:20`); dica com a senha padrão sempre visível no browser (`components/login/LoginForm.tsx:13`); sem limite de tentativas; sessão de ~30 dias.
- **Leitura de arquivos:** `romPath` sem validação gravado pelo admin (`app/api/admin/games/route.ts:35,54`) e lido com `readFileSync` sem limite de pasta (`app/api/rom/[slug]/route.ts:121-125`).
- **Sinal observável:** um `curl` anônimo para `/api/admin/games` cria, edita ou apaga jogos.
- **Contorno atual:** nenhum.

## Users

| role | goal | pain |
|---|---|---|
| Admin (dono do RetroKey) | Ser o único a gerenciar jogos e cartuchos, com histórico do que mudou | Qualquer pessoa altera o catálogo; senha padrão visível; sem histórico |
| Jogador | Validar o cartucho NFC e jogar | Catálogo pode ser adulterado; precisa continuar jogando sem login |

## Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Guard de sessão em cada handler admin + middleware só redireciona `/admin` | Next 14.2.15 é anterior ao patch do bypass de middleware CVE-2025-29927; o handler é a barreira real | Só middleware — contornável nesta versão |
| Bloqueio por tentativas no MongoDB (5 falhas / 15 min por usuário+IP), fail closed em produção | Único armazenamento compartilhado entre as instâncias da Vercel | Contador em memória — não compartilha entre instâncias; fail open — proteção some quando o Mongo cai; firewall da Vercel — fora do repositório |
| Senha em `ADMIN_PASSWORD_HASH` (scrypt, `node:crypto`) + script gerador | Sem dependência nova; senha não fica legível no painel de env | Texto puro com `timingSafeEqual`; bcrypt — dependência nova |
| Produção sem credenciais ou `AUTH_SECRET` recusa todo login; dev mantém `admin`/`admin123` | Elimina a senha padrão em produção sem quebrar `npm run dev` | Manter os padrões e só esconder a dica |
| Sessão do admin de 8 horas | Ferramenta admin; reduz o valor de um cookie roubado | Padrão da biblioteca (~30 dias); 24h; 7 dias |
| Auditoria em coleção `admin_audit` + console | Registro durável para investigar fraude | Só console — expira nos logs da Vercel |
| `romPath` derivado no servidor + contenção em `public/roms` na leitura | Corrige a entrada e protege registros antigos | Hotfix separado |
| 2FA/TOTP adiado | Hash, bloqueio, sessão curta e fail closed cobrem o objetivo | Incluir agora — lib nova e fluxo de cadastro do código |

## Scope
### Includes
- SF01 admin-api-guard: guard nas 10 rotas `/api/admin/*`, middleware para `/admin`, tratamento de 401/403 nas abas do admin.
- SF02 login-hardening: hash scrypt, bloqueio por tentativas, fail closed em produção, sessão de 8h, dica oculta em produção, mensagem genérica com 429, testes e `.env.example` só com nomes.
- SF03 admin-audit-trail: coleção `admin_audit` para logins e alterações de jogos e cartuchos.
- SF04 rom-path-containment: `romPath` gerado pelo servidor e leitura restrita a `public/roms`.

### Does NOT Include
- 2FA/TOTP — adiado; exige lib nova e fluxo de cadastro do código.
- Vários usuários admin ou cadastro de admins — o objetivo cobre um único admin.
- Trocar as credenciais expostas e tirar `.env` e `cookies.txt` do git — ação do dono do projeto, fora do código.
- Exigir login em `/api/rom/[slug]` — o emulador carrega a ROM sem sessão.
- Atualizar o Next para 14.2.25+ — o guard no handler não depende do middleware.
- Tela de consulta da auditoria — consulta direta no MongoDB basta para investigar.

## Success Metrics

| metric | target | source |
|---|---|---|
| Chamadas a `/api/admin/*` sem sessão | 100% recebem 401 | testes do guard em `tests/` e E2E em `e2e/` (specs `@playwright/test` escritas pelo `/add-build` via qa-pipeline) |
| Tentativa após 5 falhas em 15 min | 429 | `tests/login-throttle.test.ts` |
| Logins aceitos em produção sem env de credenciais | 0 | `tests/auth-config.test.ts` |
| `romPath` fora de `public/roms` lido | 0 | `tests/rom-path.test.ts` |
| Alterações admin com registro em `admin_audit` | 100% | testes dos handlers |

## Relations
None

## Observations
- [constraint] deploy na Vercel serverless: memória não é compartilhada entre instâncias #auth
- [constraint] middleware roda no edge runtime: sem `node:crypto` e sem driver `mongodb` #auth
- [constraint] `tests/auth-config.test.ts:5-27` afirma os padrões atuais e muda junto com SF02 #auth
- [impact] `.env` e `cookies.txt` estão versionados no GitHub; as credenciais devem ser trocadas antes do deploy #security
- [risk] jogos legados com `romPath` em texto livre param de carregar até o admin reenviar a ROM na edição #rom
- [constraint] as linhas E2E das métricas usam `e2e/<surface>.qa.spec.ts` com `@playwright/test`, que `/add-build` cria via qa-pipeline (`.claude/skills/qa-project/SKILL.md`) #qa
- [risk] deploy sem `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `AUTH_SECRET` na Vercel bloqueia todo login; o dono define as três antes do deploy #auth
- [measurement] 10 handlers admin sem verificação de sessão (games, games/[id], cartridges, cartridges/[id]) #admin

## References
- `docs/features/0001F-admin-secure-login/epic.md`
- `docs/features/0001F-admin-secure-login/discovery.md`
- `docs/features/0001F-admin-secure-login/past-features.md`
- `docs/code-quality-review.md`
- `.codeadd/wiki/domains/backend.md`
