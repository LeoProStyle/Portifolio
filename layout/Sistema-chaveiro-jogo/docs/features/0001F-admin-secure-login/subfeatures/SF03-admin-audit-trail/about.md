---
id: 0001F-SF03
type: feature
slug: admin-audit-trail
status: pending
branch: feature/0001F-admin-secure-login
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [audit, admin, mongodb]
---

# SF03 — Admin Audit Trail

## TL;DR
Subfeature de 0001F que grava cada login e cada alteração de jogo ou cartucho numa coleção `admin_audit` no MongoDB. Hoje só existe `console.log`, que expira nos logs da Vercel. Depois dela, uma suspeita de fraude pode ser investigada.

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

**Serves the feature objective by:** permitir investigar depois um login suspeito ou uma alteração do catálogo.

## Problem
Não existe registro durável de quem alterou o catálogo.
- O único registro é `logAuthEvent` → `console.info` (`lib/auth-config.ts:25-27`).
- Os logs da Vercel expiram; não dá para saber depois quem apagou um jogo.

## Users

| role | goal | pain |
|---|---|---|
| Admin | Saber o que mudou, quando e de onde | Sem histórico para investigar uma alteração suspeita |

## Requirements
- **RF01:** O sistema grava em `admin_audit` cada login bem-sucedido, falho e bloqueado.
- **RF02:** O sistema grava em `admin_audit` cada criação, edição e remoção de jogo ou cartucho.
- **RF03:** Cada registro tem usuário, ação, tipo e id do alvo, data/hora e IP. O IP vem da mesma função de SF02 (primeiro valor de `x-forwarded-for`, ou `unknown`).
- **RF04:** Em eventos de login, tipo e id do alvo são `login` e `null`. Em ações admin, `usuário` é o id da sessão validada pelo guard de SF01. Em login falho ou bloqueado, `usuário` é o nome tentado (permitido: SF02 RN05 proíbe só o usuário esperado).
- **RN01:** Nenhum registro contém o corpo da requisição, senha, hash ou token.
- **RN02:** Toda gravação de auditoria também sai no console com o prefixo `[audit]`.
- **RN03:** Uma falha ao gravar a auditoria não desfaz nem bloqueia a ação do admin; o erro é logado.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Coleção no MongoDB + console | Durável e consultável; MongoDB já é o armazenamento do projeto | Só console — expira nos logs da Vercel |
| Falha na auditoria não bloqueia a ação | No fallback em memória (sem Mongo) o admin continua operando | Bloquear a ação — o catálogo pararia junto com o Mongo |

## Scope
### Includes
- Coleção `admin_audit` e uma função única de gravação.
- Chamadas de auditoria nos handlers admin e no fluxo de login.

### Does NOT Include
- Tela para consultar a auditoria — consulta direta no MongoDB basta para investigar.
- Alertas automáticos — não pedidos.
- Retenção/expiração dos registros — sem regra definida pelo dono.

## Success Metrics

| metric | target | source |
|---|---|---|
| Ações admin com registro de auditoria | 100% de criar/editar/remover | teste dos handlers |
| Registros com corpo, senha ou token | 0 | teste da função de auditoria |
| Logins gravados (sucesso, falha, bloqueado) | 3 tipos registrados | teste da função de auditoria |
| Campos de cada registro | usuário, ação, tipo e id do alvo, data/hora, IP presentes | teste da função de auditoria |

## Relations
- part_of [[0001F]]

## Observations
- [constraint] depende da identidade do guard de SF01 e dos eventos de login de SF02 #audit

## References
- {{doc:0001F}}
- `docs/features/0001F-admin-secure-login/discovery.md`
