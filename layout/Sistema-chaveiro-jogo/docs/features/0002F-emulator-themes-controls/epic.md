---
id: 0002F
type: epic
created: 2026-11-06
updated: 2026-11-09
related: [0002F]
tags: [emulator, ui, mobile, controls, themes, admin]
---

# Epic: Emulator Themes and Controls

## TL;DR
Epic de 0002F-emulator-themes-controls: três subfeatures que, juntas, deixam o jogo agradável no PC e no celular, com visual e controles prontos para os 12 consoles e ajustáveis pelo admin. SF01 e SF02 não dependem uma da outra; SF03 depende das duas e do merge do 0001F.

## Subfeatures

| id | name | objective | status | dependencies | checkpoint |
|---|---|---|---|---|---|
| SF01 | play-screen-themes | Tela de jogo responsiva no PC e no celular com tema inspirado em cada um dos 12 consoles | done | | 0002F-SF01-done |
| SF02 | emulator-controls | Teclado, gamepad e controle virtual prontos para os 12 consoles, com legenda, remapeamento local e tela cheia no celular | pending | | |
| SF03 | admin-customization | Aba no admin para tema e controles por console, tema por jogo e link de fundo, servidos por uma rota pública resolvida | pending | SF01, SF02 | |
| SF04 | console-bezels | Bezel PNG por console enviado pelo admin (aba própria Bezels, R2, sem MongoDB), atrás do jogo em telas largas; no celular o jogo ocupa a tela sem moldura | done | SF01 | 0002F-SF04-done |

## Notes
- Os três SFs compartilham a branch `feature/0002F-emulator-themes-controls`.
- 2026-11-06 — decisão do dono: a branch saiu do main (`2b2c1a8a`, merge do 0001F SF01, SF02 e SF04) antes do merge completo do 0001F, porque SF01 e SF02 não dependem do 0001F. O 0001F SF03 (admin-audit-trail) segue pendente na branch `feature/0001F-admin-secure-login`, e nada dela entra nesta branch.
- SF03 (admin-customization) fica adiada até o dono pedir. Só começa com o 0001F inteiro no main, incluindo o 0001F SF03 admin-audit-trail.
- SF03 usa o formato de tema do SF01 e o formato de mapa de controle do SF02.
- SF03 depende do guard `requireAdmin` do 0001F SF01.
- SF01 é dono do layout da página e do quadro do emulador; SF02 se encaixa nesse layout (legenda, botão de tela cheia, controle virtual) e não altera as proporções. Ordem de execução: SF01, depois SF02, depois SF03.
- 2026-11-06 — decisão do dono, durante o review-001: SF04 (console-bezels) entra no epic e é executada antes da SF02. `status.cjs` aponta a primeira linha `pending` (SF02), então `/add-plan` e `/add-build` da SF04 miram a SF04 explicitamente.
- SF04 libera, só para a rota nova `app/api/admin/bezels/[console]`, a restrição de não mexer em `app/api/admin/**`; as rotas admin existentes, `lib/mongo.ts`, login e middleware continuam intocados. O envio de bezel não tem auditoria até o 0001F SF03.
- SF04 muda o layout do celular da SF01: sem bezel e sem moldura CSS, jogo na maior área possível. Os espaços da SF02 (legenda, controle virtual, tela cheia) continuam.
- O envio de bezel em arquivo (SF04) substitui o "link de fundo" previsto na SF03; a SF03 não traz mais imagem de fundo por link.
- 2026-11-09 — decisão do dono, no `/add-plan` da SF04: os bezels ficam numa aba própria "Bezels" do admin, não na aba Cartridges. A aba Cartridges não é usada (o dono grava o link do jogo direto na tag NFC); a remoção dela, das rotas `app/api/admin/cartridges/**` e do fluxo `/nfc/[id]` é um trabalho separado, fora deste epic até o dono abrir.
