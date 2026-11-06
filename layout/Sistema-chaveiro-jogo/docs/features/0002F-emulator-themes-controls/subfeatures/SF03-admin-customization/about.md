---
id: 0002F-SF03
type: feature
slug: admin-customization
status: pending
branch: feature/0002F-emulator-themes-controls
created: 2026-11-06
updated: 2026-11-06
related: [0002F]
tags: [admin, themes, controls, api]
---

# SF03 — Admin Customization

## TL;DR
Subfeature de 0002F que dá ao admin uma aba para editar tema e controles de cada console, um tema próprio por jogo e um link de imagem de fundo. O jogador recebe a configuração já resolvida (jogo, depois console, depois padrão do código) por uma rota pública que funciona sem MongoDB.

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
Jogar no RetroKey é agradável no PC e no celular: cada um dos 12 consoles abre com visual e controles prontos, e o admin ajusta tema e controles sem mexer em código. `[from conversation, no brainstorm]`

**Serves the feature objective by:** permitir ao admin ajustar visual e controles sem mexer em código.

## Problem
- O admin só gerencia jogos e cartuchos (`app/admin/page.tsx:18`); não há onde guardar tema ou controles (`models/game.ts:1-11`).
- A leitura pública `/api/game/[id]` devolve o jogo inteiro sem projeção (`app/api/game/[id]/route.ts:13`).
- Sem MongoDB, o admin grava em `lib/admin-store.ts`, que a leitura pública não usa (`lib/data.ts:26`).

## Users

| role | goal | pain |
|---|---|---|
| Admin | Ajustar tema e controles por console e por jogo | Só mexendo em código |
| Jogador | Receber o visual e os controles certos sem login | — |

## Requirements
- **RF01:** Nova aba no admin lista os 12 consoles e edita, de cada um, as cores do tema, o estilo da moldura (lista fechada do SF01), o link da imagem de fundo e o mapa de teclado padrão (formato do SF02).
- **RF02:** No cadastro de jogo, o admin define um tema próprio do jogo (cores, moldura, link de fundo) que substitui o do console; limpar o campo volta ao tema do console.
- **RF03:** O link de imagem de fundo aceita só `https://` de domínios da lista fixa no código definida pelo SF01.
- **RF04:** Uma rota pública devolve, para um jogo, o tema e o mapa de controles já resolvidos. O tema resolve jogo, depois console, depois padrão; o mapa de controles resolve perfil do console, depois padrão (não há mapa por jogo).
- **RN01:** Ordem de resolução: tema do jogo, depois perfil do console, depois padrão do código; cada campo inválido ou ausente cai no nível seguinte.
- **RN02:** Toda escrita passa por `requireAdmin` (0001F SF01); a rota pública não exige login.
- **RN03:** A API admin recusa com 400 qualquer valor fora do formato do SF01 (cor, moldura, link) e do SF02 (mapa de controle).
- **RN04:** Com MongoDB fora do ar, a rota pública responde com os padrões do código, e os perfis de console e o tema por jogo gravados em memória aparecem na leitura.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Coleção `emulator_profiles` por sistema + campo opcional de tema no jogo | Perfil serve todos os jogos do console | Só campos no jogo |
| Rota pública nova em vez de estender `/api/game/[id]` | Catálogo e visual separados | Misturar na rota do jogo |
| Link https com lista de domínios | Sem endereço público do R2 | Upload — adiado |

## Scope
### Includes
- Coleção, store com fallback em memória, handlers admin com `requireAdmin`, aba no admin, campos de tema no cadastro de jogo, rota pública resolvida.
- Correção da divergência entre `lib/admin-store.ts` e `lib/data.ts` para os dados desta feature.

### Does NOT Include
- Upload de imagem para o R2.
- Tema global.
- Auditoria das alterações — 0001F SF03.

## Success Metrics

| metric | target | source |
|---|---|---|
| Escrita sem sessão de admin | 100% recebem 401 | testes dos handlers |
| Valor fora do formato aceito | 0 | testes dos handlers |
| Rota pública com MongoDB fora do ar | responde com padrões | teste da rota |
| Tema do jogo substitui o do console na tela | sim | E2E em `e2e/` |

## Relations
- part_of [[0002F]]
- depends_on [[0002F-SF01]] — formato e validação do tema
- depends_on [[0002F-SF02]] — formato dos mapas de controle
- depends_on [[0001F]] — guard `requireAdmin` do SF01; só começa com o 0001F inteiro (incluindo o SF04) no main

## Observations
- [risk] o 0001F SF04 mexe nos mesmos handlers de jogos (`app/api/admin/games/**`); a ordem de merge importa #admin
- [risk] `active` chega do formulário como texto `'true'`/`'false'` e é gravado sem conversão (`app/api/admin/games/route.ts:32,60`) #admin

## References
- {{doc:0002F}}
- `docs/features/0002F-emulator-themes-controls/discovery.md`
