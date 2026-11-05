---
id: 0001F
type: epic
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [auth, admin, security]
---

# Epic: Admin Secure Login

## TL;DR
Epic de 0001F-admin-secure-login: quatro subfeatures que, juntas, fazem só o admin autenticado alterar jogos e cartuchos e tornam o login resistente a fraude. Ordem: SF01 e SF02 sem dependências; SF04 depende de SF01 (só ordem: mesmos handlers de jogos); SF03 depende de SF01 e SF02.

## Subfeatures

| id | name | objective | status | dependencies | checkpoint |
|---|---|---|---|---|---|
| SF01 | admin-api-guard | Toda rota /api/admin/* exige sessão com role admin; middleware redireciona /admin; abas do admin tratam 401/403 | done | | 0001F-SF01-done |
| SF02 | login-hardening | Senha em hash scrypt, bloqueio por tentativas no Mongo, fail closed em produção, sessão de 8h, dica oculta em produção | pending | | |
| SF03 | admin-audit-trail | Coleção admin_audit com logins e ações de criar/editar/remover | pending | SF01, SF02 | |
| SF04 | rom-path-containment | romPath derivado no servidor; /api/rom lê só dentro de public/roms | pending | SF01 | |

## Notes
- Os quatro SFs compartilham a branch `feature/0001F-admin-secure-login`.
- SF01 é a correção de maior risco: sem ele, qualquer chamada anônima altera o catálogo.
- SF03 lê a identidade do guard de SF01 e os eventos de login de SF02.
- Ordem de execução: SF01 → SF02 → SF04 → SF03. SF01 e SF04 editam os mesmos handlers de jogos (`app/api/admin/games/route.ts`, `app/api/admin/games/[id]/route.ts`); SF04 roda depois de SF01 para não reeditar o guard.
- Fora do código e antes do deploy: o dono do projeto troca as credenciais expostas e tira `.env` e `cookies.txt` do git.
