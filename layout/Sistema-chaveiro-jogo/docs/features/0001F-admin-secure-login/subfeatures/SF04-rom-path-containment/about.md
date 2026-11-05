---
id: 0001F-SF04
type: feature
slug: rom-path-containment
status: pending
branch: feature/0001F-admin-secure-login
created: 2026-11-05
updated: 2026-11-05
related: [0001F]
tags: [rom, path-traversal, security]
---

# SF04 — ROM Path Containment

## TL;DR
Subfeature de 0001F que impede a rota pública de ROM de ler arquivos fora de `public/roms`. Hoje o `romPath` gravado pelo admin vai direto para `readFileSync`. Depois dela, o servidor gera o `romPath` e a leitura fica restrita à pasta de ROMs.

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

**Serves the feature objective by:** limitar o que uma sessão de admin roubada ou abusada consegue ler do servidor pela API, impedindo a leitura de `.env` por um `romPath` forjado.

## Problem
Um `romPath` arbitrário permite ler qualquer arquivo do servidor.
- `POST /api/admin/games` e `PUT /api/admin/games/[id]` gravam `romPath` vindo do corpo sem validar (`app/api/admin/games/route.ts:35,54`, `app/api/admin/games/[id]/route.ts:66,93`).
- `GET /api/rom/[slug]` lê `path.join(cwd,'public',romPath)` com `readFileSync` sem conferir que o caminho fica dentro de `public/` (`app/api/rom/[slug]/route.ts:121-125`).
- Com a API admin aberta, um anônimo cria um jogo apontando para `../.env` e baixa o arquivo.

## Users

| role | goal | pain |
|---|---|---|
| Admin | Enviar ROMs sem expor arquivos do servidor | Um caminho forjado expõe segredos |
| Jogador | Carregar a ROM no emulador sem login | Nenhuma — a rota precisa continuar pública |

## Requirements
- **RF01:** O sistema gera o `romPath` no servidor a partir do slug e do arquivo enviado, usando `buildRomObjectKey` (`lib/r2.ts:34-50`).
- **RF02:** O sistema ignora `romPath` vindo do corpo em criação e edição de jogo.
- **RF03:** `GET /api/rom/[slug]` só lê um `romPath` local aceito (definido em RN02); qualquer outro responde 404.
- **RF04:** O arquivo usado por `buildRomObjectKey` é o arquivo de ROM do formulário multipart (`FormData`) já enviado pela aba de jogos na criação e na edição.
- **RF05:** Uma edição (PUT) sem arquivo novo preserva o `romPath` gravado.
- **RF06:** Reenviar o arquivo numa edição gera um `romPath` novo; esse é o caminho para recuperar um jogo legado que passou a responder 404.
- **RN01:** `/api/rom/[slug]` continua acessível sem login.
- **RN03:** Regra para separar R2 de local: `romPath` sem `/` inicial que começa com `roms/` é chave R2 (fluxo R2 atual); `romPath` que começa com `/roms/` é arquivo local e passa pela regra de RN02.
- **RN02:** `romPath` aceito = caminho local que, resolvido contra `public`, fica dentro de `public/roms`, com ou sem `/` inicial (o formato atual `/roms/x` é aceito). Uma chave R2 segue o fluxo R2 atual. Todo o resto, inclusive registros legados, não é lido e responde 404 com log `[rom]`.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Derivar no servidor + checar contenção na leitura | Corrige a entrada e protege registros antigos | Só validar a entrada — registros legados continuariam lidos |
| Rota de ROM continua pública | O emulador em iframe carrega a ROM sem sessão | Exigir sessão — quebraria o jogo para jogadores |

## Scope
### Includes
- Derivação do `romPath` no servidor nas rotas de jogo.
- Validador de contenção na rota de ROM, com teste unitário.

### Does NOT Include
- Tokens assinados para baixar ROM — não pedidos; a rota é pública por desenho.
- Migrar `romPath` legados no banco — registros inválidos passam a responder 404.
- Apagar o objeto no R2 ao remover um jogo — problema separado, fora do objetivo.

## Success Metrics

| metric | target | source |
|---|---|---|
| `romPath` com `..` ou absoluto | Nunca lido (404) | `tests/rom-path.test.ts` |
| ROM válida em `roms/<slug>.<ext>` | Continua carregando | E2E `e2e/play.qa.spec.ts` (criado pelo `/add-build` via qa-pipeline) |
| PUT sem arquivo novo | `romPath` gravado preservado | teste do handler |
| POST/PUT de jogo com `romPath` no corpo | Valor do corpo descartado; `romPath` gerado pelo servidor | teste do handler |

## Relations
- part_of [[0001F]]

## Observations
- [cause] leitura local em `app/api/rom/[slug]/route.ts:121-125` sem limite de pasta #security
- [constraint] `romPath` tem três formatos hoje: chave R2, `/roms/x` local ou texto livre #rom

## References
- {{doc:0001F}}
- `docs/features/0001F-admin-secure-login/discovery.md`
- `docs/code-quality-review.md`
