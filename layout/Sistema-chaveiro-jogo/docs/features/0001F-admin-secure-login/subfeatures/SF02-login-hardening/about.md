---
id: 0001F-SF02
type: feature
slug: login-hardening
status: pending
branch: feature/0001F-admin-secure-login
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [auth, login, password, throttle]
---

# SF02 — Login Hardening

## TL;DR
Subfeature de 0001F que torna o login do admin resistente a força bruta e a senha padrão. Senha em hash scrypt, bloqueio após 5 falhas em 15 minutos, login desligado em produção sem credenciais, sessão de 8 horas e dica de credenciais oculta em produção.

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

**Serves the feature objective by:** fazer o login resistir a força bruta e a senha padrão.

## Problem
O login aceita tentativas ilimitadas e cai em credenciais conhecidas.
- Sem `ADMIN_USERNAME`/`ADMIN_PASSWORD`, aceita `admin`/`admin123` (`lib/auth-config.ts:7-8`).
- Sem `AUTH_SECRET`, usa um segredo literal no código (`auth.ts:7`), o que permite forjar o JWT.
- A senha é comparada com `===` (`auth.ts:20`), não timing-safe.
- `LoginForm` é client component e chama `getAdminLoginHint()` (`components/login/LoginForm.tsx:13`); no browser as env vars não existem, então a dica com a senha padrão aparece sempre, inclusive em produção.
- A rejeição loga o `expectedUsername` (`auth.ts:31`).
- Não há limite de tentativas; sessão segue o padrão da biblioteca (~30 dias).

## Users

| role | goal | pain |
|---|---|---|
| Admin | Entrar com segurança e manter só ele com acesso | Senha padrão exposta na tela e tentativas ilimitadas |
| Atacante (ameaça) | Adivinhar ou usar a senha padrão | Hoje não encontra barreira |

## Requirements
- **RF01:** O sistema guarda a senha do admin como hash scrypt em `ADMIN_PASSWORD_HASH` e compara com `timingSafeEqual`.
- **RF02:** Um script do projeto gera o valor de `ADMIN_PASSWORD_HASH` a partir de uma senha digitada.
- **RF03:** O sistema bloqueia o login por 15 minutos para um par usuário+IP após 5 falhas em 15 minutos, respondendo 429 com `Retry-After`. A janela de 15 minutos é fixa e começa na primeira falha. Um login bem-sucedido zera o contador. `Retry-After` conta os segundos até o fim do bloqueio, que começa na 5ª falha. O status 429 é observável na resposta HTTP do callback de credenciais.
- **RF04:** O formulário de login mostra a mesma mensagem genérica para senha errada e para bloqueio. Este requisito governa só o texto da tela.
- **RF06:** Em produção, as variáveis obrigatórias são `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `AUTH_SECRET`. A variável `ADMIN_PASSWORD` em texto puro é ignorada em produção.
- **RF07:** O IP do par usuário+IP vem do primeiro valor do cabeçalho `x-forwarded-for` da Vercel. Sem o cabeçalho, o IP é `unknown`. SF03 usa a mesma função para ler o IP.
- **RF05:** A sessão do admin expira 8 horas após o login.
- **RN01:** Com `NODE_ENV=production` e sem credenciais configuradas ou sem `AUTH_SECRET`, todo login é recusado e um erro é logado.
- **RN02:** Fora de produção, sem env vars, o login aceita `admin`/`admin123` e mostra a dica de desenvolvimento. Ordem fora de produção: se `ADMIN_PASSWORD_HASH` existe, ele vale; senão `ADMIN_PASSWORD` em texto puro; senão `admin`/`admin123`. A dica aparece só quando o padrão está em uso.
- **RN03:** Em produção, se o MongoDB não responde, o login é recusado (fail closed). Fora de produção sem MongoDB, não há bloqueio por tentativas.
- **RN04:** O contador de falhas vive no MongoDB com expiração, porque a Vercel roda várias instâncias sem memória compartilhada.
- **RN05:** Nenhum log de autenticação contém a senha, o hash ou o usuário esperado.
- **RNF01:** O tempo de resposta do login não varia com a posição do primeiro caractere errado da senha.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| scrypt via `node:crypto` | Sem dependência nova; hash resistente a força bruta offline | bcrypt — adiciona dependência; texto puro — senha legível no painel de env |
| Contador no MongoDB, fail closed em produção | Único armazenamento compartilhado entre instâncias | Memória (inútil na Vercel); fail open (proteção some quando o Mongo cai) |
| Sessão de 8h | Ferramenta admin; reduz o valor de um cookie roubado | Padrão (~30 dias) |

## Scope
### Includes
- Hash scrypt, script gerador e comparação timing-safe.
- Bloqueio por tentativas com coleção no MongoDB e expiração.
- Fail closed em produção para credenciais, `AUTH_SECRET` e MongoDB indisponível.
- Sessão de 8h, dica oculta em produção, mensagem genérica, 429 no formulário.
- `tests/auth-config.test.ts` reescrito e script `test` cobrindo todos os `tests/*.test.ts`.
- `.env.example` só com nomes de variáveis.

### Does NOT Include
- 2FA/TOTP — adiado; exige lib nova e fluxo de cadastro do código.
- Vários usuários admin — o objetivo é um único admin.
- Trocar as credenciais já expostas — ação do dono do projeto.

## Success Metrics

| metric | target | source |
|---|---|---|
| 6ª tentativa em 15 min após 5 falhas | 429 | `tests/login-throttle.test.ts` |
| Login em produção sem env de credenciais | 0 aceitos | `tests/auth-config.test.ts` |
| Dica de credenciais em produção | Ausente | `tests/auth-config.test.ts` + E2E `e2e/login.qa.spec.ts` (criado pelo `/add-build` via qa-pipeline) |
| Comparação de senha | Feita só com `timingSafeEqual` sobre hashes de mesmo tamanho | teste de `lib/password.ts` e revisão de código |
| `ADMIN_PASSWORD` em texto puro em produção | Ignorada | `tests/auth-config.test.ts` |

## Relations
- part_of [[0001F]]

## Observations
- [constraint] `tests/auth-config.test.ts:5-27` hoje afirma os valores padrão e o texto da dica #auth
- [constraint] `next-auth@5.0.0-beta.31`: confirmar a API de `session.maxAge` antes do plano #auth
- [impact] credenciais do `.env` versionado foram expostas; o hash novo exige uma senha nova #security
- [constraint] o 429 com `Retry-After` não sai do `authorize` do NextAuth, que só devolve usuário ou null; o mecanismo (checagem antes do handler de credenciais) é decisão do plano #auth
- [risk] deploy sem `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `AUTH_SECRET` na Vercel bloqueia todo login; o dono define as três antes do deploy #auth

## References
- {{doc:0001F}}
- `docs/features/0001F-admin-secure-login/discovery.md`
