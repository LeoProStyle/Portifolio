---
id: 0002F
type: epic
created: 2026-11-06
updated: 2026-11-06
related: [0002F]
tags: [emulator, ui, mobile, controls, themes, admin]
---

# Epic: Emulator Themes and Controls

## TL;DR
Epic de 0002F-emulator-themes-controls: três subfeatures que, juntas, deixam o jogo agradável no PC e no celular, com visual e controles prontos para os 12 consoles e ajustáveis pelo admin. SF01 e SF02 não dependem uma da outra; SF03 depende das duas e do merge do 0001F.

## Subfeatures

| id | name | objective | status | dependencies | checkpoint |
|---|---|---|---|---|---|
| SF01 | play-screen-themes | Tela de jogo responsiva no PC e no celular com tema inspirado em cada um dos 12 consoles | pending | | |
| SF02 | emulator-controls | Teclado, gamepad e controle virtual prontos para os 12 consoles, com legenda, remapeamento local e tela cheia no celular | pending | | |
| SF03 | admin-customization | Aba no admin para tema e controles por console, tema por jogo e link de fundo, servidos por uma rota pública resolvida | pending | SF01, SF02 | |

## Notes
- Os três SFs compartilham a branch `feature/0002F-emulator-themes-controls`.
- 2026-11-06 — decisão do dono: a branch saiu do main (`2b2c1a8a`, merge do 0001F SF01, SF02 e SF04) antes do merge completo do 0001F, porque SF01 e SF02 não dependem do 0001F. O 0001F SF03 (admin-audit-trail) segue pendente na branch `feature/0001F-admin-secure-login`, e nada dela entra nesta branch.
- SF03 (admin-customization) fica adiada até o dono pedir. Só começa com o 0001F inteiro no main, incluindo o 0001F SF03 admin-audit-trail.
- SF03 usa o formato de tema do SF01 e o formato de mapa de controle do SF02.
- SF03 depende do guard `requireAdmin` do 0001F SF01.
- SF01 é dono do layout da página e do quadro do emulador; SF02 se encaixa nesse layout (legenda, botão de tela cheia, controle virtual) e não altera as proporções. Ordem de execução: SF01, depois SF02, depois SF03.
