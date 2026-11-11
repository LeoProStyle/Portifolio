---
id: 0002F-SF02
type: feature
slug: emulator-controls
status: pending
branch: feature/0002F-emulator-themes-controls
created: 2026-11-06
updated: 2026-11-06
related: [0002F]
tags: [emulator, controls, keyboard, gamepad, mobile]
---

# SF02 — Emulator Controls

## TL;DR
Subfeature de 0002F que deixa os 12 consoles jogáveis de imediato: teclado pré-configurado com legenda na tela, gamepad USB/Bluetooth já mapeado, remapeamento salvo no navegador do jogador, e no celular controle virtual no layout de cada console com tela cheia e sugestão de virar o aparelho. Master System e Game Gear ganham esquema próprio.

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

**Serves the feature objective by:** tornar cada console jogável de imediato, no teclado, no gamepad e no celular.

## Problem
- Só 6 dos 12 sistemas têm mapa explícito; SNES, N64, GB, GBC, GBA e PlayStation usam o mapa do NES (`public/emulator.html:107-121`).
- Master System e Game Gear usam o esquema `segaMD` (`public/emulator.html:74`); o ramo `segaMS` (`:71`) nunca é alcançado.
- O teclado está desligado (`public/emulator.html:129-131`).
- Não há controle virtual configurado (`EJS_VirtualGamepadSettings` ausente), nem tela cheia, nem legenda de teclas.

## Users

| role | goal | pain |
|---|---|---|
| Jogador no PC (teclado) | Jogar sem descobrir as teclas | Teclado desligado; sem legenda |
| Jogador no PC (gamepad) | Ligar o controle e jogar | Mapa errado em 6 consoles |
| Jogador no celular | Botões na tela e tela cheia | Sem controle virtual garantido |

## Requirements
- **RF01:** Cada um dos 12 sistemas tem um mapa de teclado padrão com os botões do console original.
- **RF02:** Em ponteiro fino (PC), a tela mostra uma legenda com a tecla de cada botão do console em uso; no celular (ponteiro por toque) a legenda não é exibida.
- **RF03:** Um gamepad USB/Bluetooth conectado funciona com o mapa padrão do console, sem configuração.
- **RF04:** O jogador remapeia as teclas pelo navegador; o mapa dele fica salvo só naquele aparelho e tem botão para voltar ao padrão.
- **RF05:** No celular, aparece um controle virtual com os botões do console em uso, visível em cada um dos 12 sistemas, e um botão de tela cheia. Em pé, o palco vira um console portátil (tela em cima, controle embaixo) nas cores do console; deitado, o controle fica nas laterais (dono, 2026-11-11, substitui a sugestão de girar).
- **RF06:** O módulo de controles exporta os mapas padrão e a validação do formato do mapa; o SF03 reutiliza essa validação.
- **RN01:** Master System e Game Gear usam esquema de 2 botões próprio, não o do Mega Drive.
- **RN02:** Cada mapa é um objeto `{botão do console: código de tecla}`. Os botões vêm da lista fechada daquele console e os códigos de tecla de uma lista fechada de `KeyboardEvent.code`. O emulador recebe o objeto já validado por `postMessage`, nunca texto livre. O id do console só escolhe o padrão quando não há mapa resolvido.
- **RN03:** A comunicação entre a página e o emulador confere a origem e a janela de quem envia.
- **RN04:** O remapeamento é feito num painel do RetroKey, por console, salvo no `localStorage`. O mapa do jogador vence o mapa resolvido (admin ou padrão); "voltar ao padrão" apaga o mapa salvo e volta ao resolvido.

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Testar primeiro o controle virtual do EmulatorJS; "serve" quando desenha os botões do console (incluindo analógicos e gatilhos onde o console tem) e funciona por toque em 390×844 nos 12 sistemas; senão, camada própria | A opção não foi verificada na versão `stable` | Decidir sem teste |
| Remapeamento num painel do RetroKey | Visual igual ao do site e controle sobre o que é salvo | Menu do próprio EmulatorJS |
| Remapeamento guardado no `localStorage` do jogador | Pedido: salvo só no aparelho dele | Salvar no servidor |

## Scope
### Includes
- Mapas padrão dos 12 sistemas e validação do formato, legenda, gamepad, painel de remapeamento local, controle virtual e tela cheia no celular.
- Correção do esquema de Master System e Game Gear.
- Checagem de origem e janela na comunicação página ↔ emulador.
- SF01 é dono do layout da página e do quadro; SF02 se encaixa nele (legenda, botão de tela cheia, controle virtual) sem alterar as proporções.

### Does NOT Include
- Edição dos mapas pelo admin — SF03.
- Visual e tema — SF01.

## Success Metrics

| metric | target | source |
|---|---|---|
| Sistemas com mapa de controle próprio | 12 de 12 | teste do módulo de controles |
| Master System e Game Gear com esquema `segaMS` | sim | teste do módulo de controles |
| Controle virtual visível em 390×844 | 12 de 12 sistemas | E2E em `e2e/`, parametrizado pelos 12 ids |
| Teclado habilitado e legenda mostra as teclas do console em 1366×768 | sim | E2E em `e2e/` |
| Gamepad simulado (mock de `navigator.getGamepads`) aciona o botão mapeado | sim | E2E em `e2e/` + teste manual com 1 controle físico |
| Botão de tela cheia presente; sugestão de girar aparece em 390×844 e some em 844×390 | sim | E2E em `e2e/` |
| Remapeamento sobrevive a recarregar a página; "voltar ao padrão" restaura | sim | E2E em `e2e/` |
| Mensagem de outra origem ou janela ignorada | sim | teste unitário |

## Relations
- part_of [[0002F]]

## Observations
- [risk] nomes e formato das opções de controle do EmulatorJS (`EJS_defaultControls`, `EJS_VirtualGamepadSettings`) não verificados na versão `stable` #emulator
- [constraint] `postMessage` hoje usa destino `'*'` sem checagem de origem (`public/emulator.html:182`, `components/Emulator.tsx:169-170`) #security

## References
- {{doc:0002F}}
- `docs/features/0002F-emulator-themes-controls/discovery.md`
