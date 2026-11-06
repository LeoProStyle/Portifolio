---
id: 0002F
type: feature
slug: emulator-themes-controls
status: draft
branch: feature/0002F-emulator-themes-controls
created: 2026-11-06
updated: 2026-11-06
related: [0001F]
tags: [emulator, ui, mobile, controls, themes, admin]
intent: none
---

# Emulator Themes and Controls

## TL;DR
Feature epic que deixa a tela de jogo do RetroKey agradável no PC e no celular. Hoje o emulador abre num quadro fixo de 600px, só 6 dos 12 consoles têm controles próprios, o teclado está desligado e não há controle na tela do celular. A entrega tem três subfeatures: tela responsiva com tema inspirado em cada console (SF01), controles prontos para teclado, gamepad e celular (SF02) e uma área no admin para ajustar tema e controles por console e por jogo (SF03).

## TOC
- [Objective](#objective)
- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [Relations](#relations)
- [Observations](#observations)
- [References](#references)

## Objective
Jogar no RetroKey é agradável no PC e no celular: cada um dos 12 consoles abre com visual e controles prontos, e o admin ajusta tema e controles sem mexer em código. `[from conversation, no brainstorm]`

**How each subfeature serves it:**
- SF01 — deixa a tela de jogo bonita e no tamanho certo em qualquer aparelho.
- SF02 — torna cada console jogável de imediato, no teclado, no gamepad e no celular.
- SF03 — permite ao admin ajustar visual e controles sem mexer em código.

## Problem
A tela de jogo é igual para todos os consoles e não se adapta ao aparelho.
- **Afetados:** jogadores no PC e no celular; o admin, que não tem como mudar o visual.
- **Quadro fixo:** o iframe tem `height: '600px'` (`components/Emulator.tsx:206`) e a página usa `max-w-5xl px-6 py-16` (`app/play/[slug]/page.tsx:40`); não há tela cheia nem tratamento de orientação.
- **Controles:** só NES, Mega Drive, Master System, Game Gear, Arcade e Neo Geo têm mapa explícito (`public/emulator.html:55-106`); SNES, N64, GB, GBC, GBA e PlayStation caem no mapa do NES (`:107-121`). Master System e Game Gear usam o esquema `segaMD` (`:74`).
- **Teclado desligado:** `keyboardInput` e `altKeyboardInput` = `'disabled'` (`public/emulator.html:129-131`).
- **Sem visual por console:** nenhum `EJS_color`, fundo ou moldura é definido; nada é configurável pelo admin.
- **Contorno atual:** nenhum.

## Users

| role | goal | pain |
|---|---|---|
| Jogador no PC | Jogar com teclado ou gamepad sem configurar nada | Teclado desligado; controles errados em 6 consoles; tela pequena e fixa |
| Jogador no celular | Jogar com botões na tela, em tela cheia | Quadro de 600px, sem controle virtual garantido nem tela cheia |
| Admin (dono do RetroKey) | Ajustar o visual e os controles de cada console e jogo | Só editando código |

## Requirements
- **RF01:** Tema "inspirado no console" pronto para os 12 sistemas (cores, moldura e fundo no estilo do aparelho original).
- **RF02:** Tela de jogo responsiva no PC e no celular, sem a altura fixa de 600px.
- **RF03:** Teclado pré-configurado por console, com legenda na tela de cada tecla.
- **RF04:** Gamepad USB/Bluetooth reconhecido e já mapeado por console.
- **RF05:** O jogador remapeia as teclas no próprio navegador; fica salvo só no aparelho dele.
- **RF06:** No celular: controle virtual no layout de cada console, botão de tela cheia e sugestão de virar o aparelho na horizontal.
- **RF07:** Admin, nova aba: tema e controles por console.
- **RF08:** Admin, cadastro do jogo: tema próprio que substitui o do console.
- **RF09:** Fundo por imagem via link https colado pelo admin, aceito só de domínios de uma lista fixa no código (início: `i.imgur.com`, `upload.wikimedia.org`, `raw.githubusercontent.com`); mudar a lista exige deploy.
- **RN01:** O jogo usa o tema do jogo, depois o do console, depois o padrão do código; sem MongoDB, o padrão do código funciona.
- **RN02:** Só admin altera temas e controles (guard do 0001F SF01); jogar continua sem login.
- **RN03:** Cores e links passam por validação; nenhum CSS ou HTML livre chega ao emulador.
- **RN04:** Master System e Game Gear ganham o próprio esquema de controle.
- **RN05:** A comunicação entre página e emulador confere origem e janela, porque a configuração resolvida (mapas e temas) trafega por `postMessage`.

## Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Temas por console numa coleção `emulator_profiles`; sobrescrita por jogo em campo opcional no jogo | Perfil por sistema serve todos os jogos; o jogo carrega só a diferença | Tudo nos campos do jogo — repete o tema em cada jogo |
| Rota pública que devolve a configuração já resolvida (jogo → console → padrão) | Um ponto anônimo para o jogador; `/api/game` não muda | Estender `/api/game/[id]` — mistura catálogo e visual |
| Padrões dos 12 consoles no código | A tela funciona sem MongoDB | Só dados no banco — tela quebra sem Mongo |
| Tema como valores validados (cor hex, número com limite, link https de domínio permitido) | O emulador roda na mesma origem do site; texto livre vira XSS | CSS ou HTML livre |
| Fundo e moldura desenhados na página em volta do emulador | Não depende de opções não verificadas do EmulatorJS | `EJS_color` / `EJS_backgroundImage` dentro do iframe |
| Mapa de controle é um objeto `{botão do console: código de tecla}` validado (botões de lista fechada por console, teclas de lista fechada de `KeyboardEvent.code`), entregue ao emulador já validado por `postMessage` | O admin edita mapas, então o emulador recebe dados, nunca texto livre; uma fonte única para os 12 consoles e para o admin | Continuar com blocos fixos no `emulator.html`; passar só um id |
| Remapeamento do jogador num painel do RetroKey, salvo por console no navegador | Visual igual ao do site e controle sobre o que é salvo | Menu do próprio EmulatorJS |
| Domínios de imagem numa lista fixa no código | Uma sessão de admin roubada não libera sites novos | Lista editável no admin |
| Controle virtual: testar primeiro o do EmulatorJS; se não servir, camada própria | A opção do EmulatorJS não foi verificada na versão `stable` | Escolher agora sem teste |
| Imagem de fundo por link https | Sem configurar endereço público do R2 | Upload para o R2 — adiado |
| Branch nasce do main depois do merge do 0001F inteiro (incluindo o SF04); SF03 só edita `app/api/admin/games/**` com o SF04 já no main | A área admin depende do guard do SF01 e o SF04 mexe nos mesmos handlers | Branch em cima do 0001F |

## Scope
### Includes
- SF01 play-screen-themes: tela responsiva no PC e no celular; tema "inspirado no console" para os 12 sistemas; validação dos valores de tema.
- SF02 emulator-controls: teclado e gamepad pré-configurados por console, legenda de teclas, remapeamento salvo no navegador, controle virtual e tela cheia no celular, esquema próprio de Master System e Game Gear, checagem de origem na comunicação com o emulador.
- SF03 admin-customization: aba no admin para tema e controles por console, tema por jogo, link de imagem de fundo, rota pública da configuração resolvida, correção da leitura em memória sem MongoDB para perfis de console e tema por jogo.

### Does NOT Include
- Tema global da tela de jogo — não pedido.
- Upload de imagem para o R2 — adiado; exige endereço público do bucket.
- Outros estilos prontos (neon, CRT, minimalista) — só o "inspirado no console" foi escolhido.
- Auditoria das alterações de tema — fica com o 0001F SF03.
- Mudar a lógica de troca de core do emulador (`components/Emulator.tsx:16-44`).

## Success Metrics

| metric | target | source |
|---|---|---|
| Consoles com tema e mapa de controle próprios | 12 de 12 | testes de `lib/emulator-profiles` |
| Jogo visível sem rolagem em 390×844, 844×390 e 1366×768, com legenda e controle virtual presentes | sim | E2E em `e2e/` (qa-pipeline) |
| Controle virtual visível no celular | 12 de 12 sistemas | E2E em `e2e/` |
| Teclado habilitado com legenda em 1366×768; gamepad simulado aciona o botão mapeado | sim | E2E em `e2e/` + teste manual com 1 controle físico |
| Remapeamento sobrevive a recarregar e "voltar ao padrão" restaura | sim | E2E em `e2e/` |
| Mensagem de outra origem ou janela ignorada | sim | teste unitário |
| Link de imagem fora da lista de domínios aceito | 0 | testes da validação e dos handlers |
| Tela de jogo funcionando com MongoDB fora do ar | sim, com o tema padrão | teste da rota pública |
| Valor de tema fora do formato aceito pela API admin | 0 aceitos | testes dos handlers |

## Relations
- depends_on [[0001F]] — a área admin usa o guard do SF01 e a branch nasce depois do merge

## Observations
- [constraint] o emulador (`public/emulator.html`) roda na mesma origem do site e carrega script do CDN `cdn.emulatorjs.org/stable` sem versão fixa #security
- [constraint] `postMessage` usa destino `'*'` e o receptor não confere a origem (`public/emulator.html:182`, `components/Emulator.tsx:169-170`) #security
- [risk] opções do EmulatorJS para cor, fundo e controle virtual não foram verificadas na versão `stable` #emulator
- [risk] o 0001F SF04 mexe nos mesmos handlers de jogos; a ordem de merge importa #admin
- [impact] o modo sem Mongo do admin grava em `lib/admin-store.ts`, que a leitura pública não usa (`lib/data.ts:26`) #data
- [risk] `active` chega como texto `'true'`/`'false'` do formulário do admin e é gravado sem conversão (`app/api/admin/games/route.ts:32,60`) #admin

## References
- `docs/features/0002F-emulator-themes-controls/discovery.md`
- `docs/features/0002F-emulator-themes-controls/past-features.md`
- `docs/features/0001F-admin-secure-login/epic.md`
