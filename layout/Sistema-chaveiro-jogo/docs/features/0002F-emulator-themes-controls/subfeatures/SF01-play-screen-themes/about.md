---
id: 0002F-SF01
type: feature
slug: play-screen-themes
status: pending
branch: feature/0002F-emulator-themes-controls
created: 2026-11-06
updated: 2026-11-06
related: [0002F]
tags: [emulator, ui, mobile, themes]
---

# SF01 — Play Screen Themes

## TL;DR
Subfeature de 0002F que troca o quadro fixo de 600px por uma tela de jogo responsiva no PC e no celular, e dá a cada um dos 12 consoles um tema "inspirado no console" (cores, moldura e fundo no estilo do aparelho original). Os temas ficam no código como valores validados e funcionam sem MongoDB.

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

**Serves the feature objective by:** deixar a tela de jogo bonita e no tamanho certo em qualquer aparelho.

## Problem
- O iframe tem altura fixa de 600px (`components/Emulator.tsx:206`) e a página usa `max-w-5xl px-6 py-16` (`app/play/[slug]/page.tsx:40`).
- Não existe tema: todos os consoles mostram o mesmo cartão escuro; `Game` não tem campo de tema (`models/game.ts:1-11`).

## Users

| role | goal | pain |
|---|---|---|
| Jogador no PC | Ver o jogo grande e com visual do console | Quadro pequeno e igual para todos |
| Jogador no celular | Jogo ocupando a tela sem rolagem | Quadro de 600px que não cabe |

## Requirements
- **RF01:** Cada um dos 12 sistemas (NES, SNES, Nintendo 64, Game Boy, Game Boy Color, Game Boy Advance, Master System, Mega Drive / Genesis, Game Gear, PlayStation, Arcade (FBNeo), Neo Geo) tem um tema padrão "inspirado no console": cor de fundo, cor de destaque, cor da moldura e estilo da moldura.
- **RF02:** A tela de jogo se ajusta à largura e altura do aparelho, mantém a proporção da imagem do console e não exige rolagem para ver o jogo em 390×844, 844×390 e 1366×768. A medição vale com a legenda e o controle virtual do SF02 presentes: a legenda só ocupa espaço em ponteiro fino (PC), e no celular o controle virtual fica sobre o quadro do jogo.
- **RF03:** O fundo e a moldura são desenhados na página, em volta do emulador.
- **RN01:** O tema de um jogo vem do padrão do console no código quando não há outro valor; funciona com MongoDB fora do ar.
- **RN02:** Um tema só aceita valores validados: cor hex `#RRGGBB`, estilo de moldura de uma lista fechada, imagem só por link `https://` cujo host é igual, byte a byte (em minúsculas), a uma entrada da lista fixa no código (início: `i.imgur.com`, `upload.wikimedia.org`, `raw.githubusercontent.com`); subdomínios, porta, usuário e senha na URL são recusados. Valor inválido cai no padrão do console.
- **RN03:** Sistema desconhecido usa um tema neutro padrão.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Padrões dos 12 temas num módulo puro em `lib/` | Testável e sem banco | Só no banco |
| Validação num único ponto, usada também pelo SF03 | Um formato de tema para a tela e para o admin | Validar em cada tela |
| Estilos de moldura: um por aparência de console original (12) mais `neutral`; os nomes são definidos no plano | O admin escolhe numa lista (SF03) e o validador conhece cada valor | Moldura livre |
| Lista de domínios de imagem: constante num módulo de `lib/`, dona SF01; SF03 só consome | Mudar a lista exige deploy, decisão do dono | Lista editável no admin |

## Scope
### Includes
- Módulo de temas padrão e validação.
- Página `/play/[slug]` e componente do emulador responsivos, com tema aplicado.

### Does NOT Include
- Controles e controle virtual — SF02.
- Edição de tema pelo admin e rota pública — SF03.

## Success Metrics

| metric | target | source |
|---|---|---|
| Sistemas com tema padrão | 12 de 12 | teste do módulo de temas |
| Valor inválido aceito como tema | 0 | teste da validação |
| Link https fora da lista de domínios aceito (inclui `https://i.imgur.com.evil.com` e `https://x.i.imgur.com`) | 0 | teste da validação |
| Jogo visível sem rolagem em 390×844, 844×390 e 1366×768 | sim | E2E em `e2e/` |

## Relations
- part_of [[0002F]]

## Observations
- [constraint] o emulador roda na mesma origem do site; nenhum texto livre de tema pode chegar ao iframe #security
- [constraint] `Room.theme` já existe com outro sentido (`models/game.ts:22`); o novo campo usa outro nome #data

## References
- {{doc:0002F}}
- `docs/features/0002F-emulator-themes-controls/discovery.md`
