---
id: 0002F-SF02
type: feature-plan
created: 2026-11-09
updated: 2026-11-09
related: [0002F]
tags: [emulator, controls, keyboard, gamepad, mobile]
---

# Plan: 0002F-emulator-themes-controls — SF02 emulator-controls

> **Delivery:** confirm

## TL;DR
Plano da SF02 do {{doc:0002F}}. Ele deixa os 12 consoles jogáveis no teclado, no gamepad e no celular, sem mudar o tamanho nem a proporção da janela do jogo.
- **Módulo de controles:** um módulo puro `lib/emulator-controls.ts` define os botões de cada console, as teclas aceitas, os mapas padrão, a validação (reusada pela SF03) e o formato das mensagens.
- **Emulador:** o `public/emulator.html` recebe o id do console pela URL e o mapa e os toques por `postMessage` com origem conferida. Ele escuta o teclado e chama `simulateInput` do EmulatorJS.
- **Tela de jogo:** em `Wide`, uma legenda de teclas e o painel Keys para remapear, salvo no `localStorage`. No toque, um controle virtual próprio do RetroKey e uma sugestão de girar. A tela cheia fica em todo viewport com suporte.
- **Spike:** um spike manual com 1 ROM do dono abre o build e confirma a API de input do EmulatorJS.

São 12 tarefas: 1 spike, 2 do módulo, 2 do emulador, 3 de componentes, 2 de E2E, 1 manual e 1 do gate.

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Frontend](#frontend)
- [QA/E2E Specification](#qae2e-specification)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Jogar no RetroKey é agradável no PC e no celular: cada um dos 12 consoles abre com visual e controles prontos, e o admin ajusta tema e controles sem mexer em código. `[from conversation, no brainstorm]`

Quando este plano estiver construído, o jogador de qualquer um dos 12 consoles joga sem configurar nada:
- **Teclado:** funciona com legenda em `Wide` e pode ser remapeado no aparelho.
- **Gamepad:** funciona com o mapa padrão.
- **Celular:** tem botões na tela e tela cheia.

## Context
O about da SF02 ({{doc:0002F-SF02}}) pede mapa de teclado para os 12 consoles (RF01), legenda (RF02), gamepad (RF03), remapeamento local (RF04), controle virtual e tela cheia no celular (RF05), módulo exportado para a SF03 (RF06) e as regras RN01-RN04. Este plano fixa os contratos de código:
- os exports de `lib/emulator-controls.ts`;
- o protocolo entre página e `emulator.html`;
- o `EmulatorHandle`;
- os componentes novos nos slots da SF04;
- o spike que confirma o EmulatorJS antes do código.

Layout, estados, textos e tokens estão em `subfeatures/SF02-emulator-controls/design.md` e não se repetem aqui. O plano parte do código entregue na SF04 (`checkpoint/0002F-SF04-done`).

Três decisões do dono mudam o about:
- **Controle virtual:** é uma camada própria do RetroKey, não o controle do EmulatorJS (epic.md Notes).
- **Legenda (RF02):** o "ponteiro fino" do RF02 vale só em `Wide` (`(min-width: 1024px) and (pointer: fine)`), pela regra D10 da SF04, mantida pelo dono (design.md C2); abaixo de 1024px com mouse não há legenda (cross-SF consistency).
- **Métrica do gamepad:** a métrica "mock de `navigator.getGamepads` em E2E" vira teste unitário da tabela de rótulos + E2E com loader falso + teste manual com 1 controle físico (OQ-1, aceito na prévia do plano).

## Global Constraints
- `{"validation_gates":{"build":"npm run build","test":"node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts"}}` (AGENTS.md Validation Gates)
- Typecheck runs inside `next build`. No lint or format gate exists. (AGENTS.md)
- `app/**` (pages + API route handlers) → `components/**` → `lib/*` → `models/*`. Imports point inward only; inner never imports outer. No circular imports. (AGENTS.md Layers)
- Import modules by path through the `@/` alias; there are no barrel files. (AGENTS.md Import Rules)
- `{"framework":{"name":"Next.js","version":"14.2.15","router":"App Router"}}`, `{"frontend":{"ui":"React 18.2","styling":"Tailwind 3.4"}}`, `"node":"24.x"` (AGENTS.md Stack)
- Cada mapa é um objeto `{botão do console: código de tecla}`. Os botões vêm da lista fechada daquele console e os códigos de tecla de uma lista fechada de `KeyboardEvent.code`. O emulador recebe o objeto já validado por `postMessage`, nunca texto livre. O id do console só escolhe o padrão quando não há mapa resolvido. (about.md RN02)
- A comunicação entre a página e o emulador confere a origem e a janela de quem envia. (about.md RN03)
- O remapeamento é feito num painel do RetroKey, por console, salvo no `localStorage`. O mapa do jogador vence o mapa resolvido (admin ou padrão); "voltar ao padrão" apaga o mapa salvo e volta ao resolvido. (about.md RN04)
- Master System e Game Gear usam esquema de 2 botões próprio, não o do Mega Drive. (about.md RN01)
- A SF02 não altera as proporções nem o quadro. (dono, epic.md Notes)
- Bezel só com `(min-width: 1024px) and (pointer: fine)`; a legenda é só em Wide, classe `hidden h-10 shrink-0 wide:block` no PlayStage; abaixo de 1024px não há legenda. (SF04 design.md; dono, restrição da rodada)
- O slot de tela cheia é o `data-slot="fullscreen"` de 44x44 no PlayTopBar; o touch-overlay segue `[@media(pointer:coarse)]` no PlayStage. (dono, restrição da rodada)
- Não mexer em lib/mongo.ts, lib/admin-login.ts, lib/login-throttle.ts, auth.ts, auth.config.ts, middleware.ts, app/api/auth/**, nas rotas admin existentes nem em app/nfc/**; em lib/auth-guard.ts, só usar requireAdmin. Em lib/r2.ts, só exports novos (getR2BucketName, getR2Endpoint e hasR2Config medidos CRITICAL em 2026-11-09). (dono, restrição da rodada)
- GitNexus impact antes de editar cada símbolo, com o índice da raiz `C:\Users\leonardoaa\Desktop\MeuPortifolio\Portifolio`; componentes JSX saem UNKNOWN, então confirmar callers por busca de texto. (dono, restrição da rodada)
- E2E só com page.route; routeBezel em todo teste Wide de e2e/play-screen.qa.spec.ts. Servidor de dev com MONGODB_DB=retrokey_e2e (.env.local é PRODUÇÃO); um projeto por vez (--project=main, depois --project=no-mongo), apagando .next antes, portas 3001/3002 livres. Nunca configurar R2_* no shell. (dono, restrição da rodada)
- Nunca abrir nem imprimir .env, .env.local, cookies.txt. Sem git push sem o dono; não reescrever histórico. `tsconfig.tsbuildinfo` não entra em commit. (dono, restrição da rodada)
- Nenhuma dependência npm nova. (Frontend → Architecture decisions, decisão deste plano)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Controle virtual próprio do RetroKey (React, slot `touch-overlay`); controle embutido do EmulatorJS desligado | O controle embutido é desenhado dentro do iframe e o E2E usa stub do `/emulator.html`; só a camada própria mede "visível em 390×844, 12 de 12" | Spike do embutido primeiro (about.md Decisions); embutido sem spike | Decisão do dono, 2026-11-09 (epic.md Notes) |
| Módulo puro `lib/emulator-controls.ts` com ids de console vindos de `lib/bezel-console.ts` | Componentes cliente, `emulator.html` (por espelho) e as rotas da SF03 usam o mesmo contrato; ids definidos uma vez | Mapas dentro do `emulator.html` (hoje); segunda lista de consoles | RF06; regra cross-SF de recurso compartilhado |
| Teclado pelo listener no `emulator.html` (`keydown`/`keyup` em captura → `simulateInput`), `value` do EmulatorJS vazio (FD2) | Remapear vira troca de objeto no iframe, sem reboot; o mesmo `simulateInput` serve ao toque | Mapa escrito em `EJS_defaultControls` antes do `loader.js` com reboot a cada remapeamento — fica como fallback FD3 se o spike S2 falhar | RF04 sem perder a partida; RN02 |
| Id do console no parâmetro `console` da URL do iframe, só os 12 ids | `EJS_controlScheme` precisa existir antes do `loader.js`, e MS/GG dividem o core com o Mega Drive | Escolher o esquema pelo core (hoje, causa do bug); id na mensagem (exige handshake antes do boot) | RN01 |
| Bloco JSON `rk-controls-contract` no `emulator.html`, comparado com o módulo por teste (T19) | HTML estático não importa TS; o teste pega divergência no gate | Servir um JS gerado no build; validação só estrutural no iframe | RN02 (listas fechadas dos dois lados) |
| `postMessage` com destino `location.origin` e checagem de `origin` + `source` nos dois lados, função pura `isTrustedMessage` | Testável com node:test; fecha o `'*'` atual | Só checar `origin` (outra janela da mesma origem passaria) | RN03; discovery.md Risks |
| Gamepad nativo do EmulatorJS com `value2` de `GAMEPAD_LABELS`; não remapeável | O EmulatorJS já lê `navigator.getGamepads`; um segundo leitor dispararia em dobro | Leitor de gamepad próprio na página | RF03; RF04 cobre só teclado |
| Métrica do gamepad: T04 (unitário) + T26 (E2E com loader falso) + T27 (manual, 1 controle) | Um mock de `getGamepads` não prova nada com o stub nem com o loader falso | Manter a métrica literal do about.md | Decisão do dono na prévia do plano, 2026-11-09 (OQ-1) |
| Spike manual com 1 ROM de Master System ou Game Gear em `public/roms/` (fora do git), página `public/roms/emulator-spike.html` | Confirma `simulateInput`, teclado, índices, esquema `segaMS`/`segaGG`, gamepad e o desligamento do controle embutido sem Mongo e sem `.env.local` | Rodar pelo `/play` com o banco de produção; pular o spike | Decisão do dono na prévia (OQ-2); restrição `.env.local` |
| Teclas padrão: setas, Z/X = B/A, A/S = Y/X, Q/W = L/R, Space = Select, Enter = Start, 5 = Coin, D-pad do N64 em I/J/K/L | O design fixa botões, não teclas; padrão comum de emuladores de PC | — | Decisão do dono na prévia (OQ-3) |
| Legenda só em `Wide`; desktop estreito com mouse fica sem legenda e sem painel (C2 recusado) | Regra D10 da SF04, mantida pelo dono | Botão Keys na barra de topo fora de `Wide` | SF04 design.md D10 |
| Tela cheia em todo viewport com `document.fullscreenEnabled` | O slot 44×44 já existe; em `Wide` amplia o palco | Só no celular (proposta do fluxo) | design.md C10 |

## Tasks
1. - [ ] spike (manual, dono + coordenador): 1 ROM de Master System ou Game Gear em `public/roms/`, cópia `public/roms/emulator-spike.html`, checklist S1-S8 (Frontend → SPIKE) — `build-ledger.md` da SF02 com a seção `## Spike`, uma linha por S#, `INPUT_PATH=listener|boot` registrado; `git status` sem `public/roms/**`; S1 negativo para o build e volta ao dono — S
2. - [ ] test: `tests/emulator-controls.test.ts` com T01-T19 e T47 (T20 só com `INPUT_PATH=boot`) — os casos ficam vermelhos até a Task 3 (módulo ausente) — S
3. - [ ] lib: `lib/emulator-controls.ts` com os exports exatos de Frontend → "Exported signatures (exact)" — T01-T18 e T47 verdes; T19 fica vermelho até a Task 4 — M
4. - [ ] emulator: GitNexus `impact` e busca de texto antes; `public/emulator.html` (bloco `rk-controls-contract`, parâmetro `console`, listener, `RK_*`, destino `location.origin`, controle embutido desligado pela opção do S7; remove os ramos por core) — T19 verde; `npm run build` verde — M
5. - [ ] frontend: `components/Emulator.tsx` (`forwardRef`, `EmulatorHandle`, parâmetro `console`, `isTrustedMessage`, `RK_CONTROLS` a cada ready) e `components/useControlMap.ts` — `npm run build` verde (o `PlayStage` passa as props novas na Task 8) — M
6. - [ ] frontend: `components/ControlsLegend.tsx` e `components/KeysPanel.tsx` — `npm run build` verde — M
7. - [ ] frontend: `components/VirtualController.tsx`, `components/RotateHint.tsx`, `components/FullscreenToggle.tsx` — `npm run build` verde — M
8. - [ ] frontend: `components/PlayStage.tsx` monta tudo nos slots (Hooks & State); `PlayTopBar` sem mudança no arquivo — `npm run build` verde; `git diff components/PlayTopBar.tsx components/ThemedFrame.tsx components/StatusStrip.tsx app/globals.css` vazio — M
9. - [ ] test: E2E de legenda, mapa, loader falso e painel em `e2e/play-screen.qa.spec.ts` (T21-T26, T28-T39, T48), helpers `stubEmulatorRecorder`, `received`, `routeFakeEjsLoader`; stubs existentes passam a postar com `location.origin` — verdes em `--project=main` e depois `--project=no-mongo` — M
10. - [ ] test: E2E de toque, sugestão, tela cheia e a11y (T40-T46, T49, T50), 12 consoles × 390×844 e 844×390 — verdes nos dois projetos; testes da SF01 e SF04 seguem verdes — M
11. - [ ] manual: T27, controle físico na página do spike (`public/roms/emulator-spike.html`, mesmo ROM) — linha S6 do `build-ledger.md`; o `/play/<slug>` não entra, porque nenhum jogo com ROM real existe no `retrokey_e2e`; depois do registro, apagar `public/roms/emulator-spike.html` — S
12. - [ ] chore: `tests/emulator-controls.test.ts` entra no `test` gate do AGENTS.md — o comando roda os 7 arquivos e sai 0, sem `R2_*` no shell — S

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| `simulateInput` não existe ou não move o jogo na versão `stable` (S1) | baixa | controle virtual e teclado sem caminho de input | Task 1 antes de qualquer código; S1 negativo para o build e volta ao dono; ausência em produção depois de mudança no CDN: degradação definida em Frontend → emulator.html protocol → Apply, coberta por T48 |
| O EmulatorJS liga teclas próprias mesmo com `value` vazio (S2) | média | teclas em dobro ou mapa do jogador ignorado | fallback FD3 (`INPUT_PATH=boot`, `EJS_KEY_NAMES`, reboot a cada remapeamento), registrado no ledger; T20 entra |
| Índices de `BUTTON_INDEX` errados nos consoles fora do ROM do spike | média | botão do controle aciona outro botão do jogo | linhas marcadas provisórias; build QA roda qualquer ROM que o dono tiver; T02 trava a forma, não o significado |
| `segaMS`/`segaGG` recusados pelo EmulatorJS (S5) | média | menu do EmulatorJS mostra rótulos do Mega Drive | o esquema é omitido para o console; o mapa de 2 botões do RetroKey mantém o RN01 |
| Opção para desligar o controle embutido desconhecida (S7) | média | dois controles na tela do celular | última opção: CSS `display:none` no contêiner do EmulatorJS; T26 confere a opção usada |
| Folga de 4px no retrato (4/3 com gatilhos, inset de 34px) | média | botão encosta na janela em aparelho com inset maior | T41 mede sem inset; Controller fit no design; ajuste do cluster no build QA se o review medir sobreposição |
| Enter do Done chega ao jogo como Start | média | jogo inicia ou pausa ao fechar o painel | foco no iframe só depois do `keyup` (design.md C6); T38 confere |
| Suíte E2E cresce (12 consoles × 2 viewports) | alta | tempo de execução maior | um projeto por vez; casos parametrizados num `describe` por viewport |
| `localStorage` bloqueado (aba privada, política) | baixa | remapeamento não persiste | estado no-storage com aviso (T37) |
| Drift entre o bloco JSON do `emulator.html` e o módulo | média | iframe aceita ou recusa tecla diferente do painel | T19 no gate de teste |

## Validation
- `npm run build` sai com 0 (typecheck incluso).
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts tests/emulator-controls.test.ts` sai com 0, sem variáveis `R2_*` no shell.
- Com `.next` apagado, portas 3001/3002 livres e `MONGODB_DB=retrokey_e2e`: `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; apagar `.next` de novo; `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`. Todos verdes, incluindo os testes da SF01 e da SF04.
- `build-ledger.md` da SF02 com `## Spike` completo (S1-S8) e a linha S6 do controle físico (T27).
- QA visual (`/add-review`) contra o `## Design Contract` do design.md da SF02 em 390×844, 844×390 (toque), 1024×768 e 1366×768.
- Antes de cada commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .` no índice da raiz. Um resultado `partial`/`truncated`, ou um índice sem os símbolos, fica registrado como NOT VERIFIED, junto com a lista de `git diff --name-only`.

---

## Test Specification

SF02 emulator-controls. Unit cases import only `lib/emulator-controls.ts` (pure, no DOM at import) and `lib/bezel-console.ts`; T19 reads `public/emulator.html` as text. E2E reaches data only through `page.route` (`**/api/game/**` via `mockGame(page, system)` for the 12 console ids, `/api/rom/**`, `/emulator.html`, the EmulatorJS CDN); every Wide test (1024x768, 1280x720 default, 1366x768) calls `routeBezel(page, 'missing')` (owner rule). "Recorder" = `stubEmulatorRecorder(page)` (stub `/emulator.html` that posts `EMULATOR_CANVAS_READY` with `location.origin` and records every received `message` `data` and every `keydown` `code` in `window.__rk`, read by `received(page)`). "Fake loader" = `routeFakeEjsLoader(page)` (real `public/emulator.html`; CDN `loader.js` replaced by a script that adds a `<canvas>` and sets `window.EJS_emulator.gameManager.simulateInput` recording calls). Touch = `hasTouch` + `isMobile`. E2E titles carry the `SF02-` prefix (`SF02-T21 …`) so they do not clash with SF01/SF04 titles in the same file.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | lib-RF01-default-map-for-12-consoles | lib | RF01 | `DEFAULT_CONTROL_MAPS[id]` for each of `BEZEL_CONSOLE_IDS` | 12 entries; each `validateControlMap(map, id)` → `ok: true` | key set of `DEFAULT_CONTROL_MAPS` = 12 ids; map keys = `BUTTONS_BY_CONSOLE[id]`; result map deepEqual input |
| T02 | lib-RF01-every-button-has-ejs-index | lib | RF01 | `buttonIndex(id, b)` for every `b` in `BUTTONS_BY_CONSOLE[id]`; `buttonIndex('nes','c')` | integer 0..23 for each listed button; `null` for a button outside the console | `toControlsMessage(default, id).bindings.length` = button count; no index outside 0..23 |
| T03 | lib-RF02-legend-groups-and-labels | lib | RF02 | `legendGroups` for `nes`, `n64`, `arcade`, `ps`; `buttonLabel('sms','start')`; `keyCapLabel` of `KeyX`, `Digit5`, `ArrowUp`, `Enter`, `Space` | D-pad, Stick and the four C each one group; flattened groups = `BUTTONS_BY_CONSOLE[id]` in order; `'Pause'`; `X`, `5`, `↑`, `Enter`, `Space` | n64 has 9 groups (Stick, D-pad, C, A, B, Z, L, R, Start), ps 11; assert `legendGroups(id).length` against the count computed from `BUTTONS_BY_CONSOLE`; deepEqual labels |
| T04 | lib-RF03-gamepad-label-table | lib | RF03 | `GAMEPAD_LABELS` | 24 entries, indices 0..23, values per the Frontend `GAMEPAD_LABELS` row (0 `BUTTON_2`, 8 `BUTTON_1`, 4-7 `DPAD_*`, 10-13 shoulders, 16-19 `LEFT_STICK_*`) | deepEqual full table; `ANALOG_INDICES` = 16..23; `ANALOG_MAX` = `0x7fff` |
| T05 | lib-RF04-apply-remap-free-and-swap | lib | RF04 | `applyRemap(nesDefault,'nes','a','KeyV')`; `applyRemap(nesDefault,'nes','a','KeyZ')` | `swappedWith: null`, `a`=`KeyV`; `swappedWith: 'b'`, `a`=`KeyZ`, `b`=`KeyX` | both results pass `validateControlMap`; input map unchanged |
| T06 | lib-RF04-storage-key-and-roundtrip | lib | RF04 | `controlsStorageKey('nes')`; `parseSavedControlMap(serializeControlMap(m),'nes')`; raw `null`, `'{'`, `'[]'`, `'"x"'`, a valid `snes` map read as `nes` | `'retrokey:controls:v1:nes'`; roundtrip deepEqual `m`; `null` for every junk input | key prefix = `CONTROLS_STORAGE_PREFIX`; parse never throws |
| T07 | lib-RF06-module-exports-for-sf03 | lib | RF06 | `import` of `lib/emulator-controls.ts` in node:test with no `window`/`document` | import succeeds; `validateControlMap`, `DEFAULT_CONTROL_MAPS`, `BUTTONS_BY_CONSOLE`, `KEY_CODES`, `isKeyCode`, `resolveControlMap` are exported | `typeof` checks; module source has no `react`, `fs` or DOM import |
| T08 | lib-RN01-ms-gg-own-2-button-scheme | lib | RN01 (+) | `BUTTONS_BY_CONSOLE.sms`, `.gamegear`; `CONSOLE_SCHEMES.sms`, `.gamegear`; `BUTTON_INDEX.sms` | lists = `up,down,left,right,1,2,start`; schemes `segaMS`, `segaGG`; `1`→0 (B), `2`→8 (A) | deepEqual; default maps `1`→`KeyZ`, `2`→`KeyX` |
| T09 | lib-RN01-ms-gg-not-mega-drive | lib | RN01 (−) | `CONSOLE_SCHEMES.megadrive`; `validateControlMap(DEFAULT_CONTROL_MAPS.megadrive,'sms')`; sms map with key `c` | `segaMD` only for megadrive; sms/gamegear scheme ≠ `segaMD`; both validations → `ok:false, error:'unknown-button'` | no `a`/`b`/`c` in the sms/gamegear lists |
| T10 | lib-RN02-valid-map-accepted | lib | RN02 (+) | nes default as plain object; same data in `Object.create(null)` | `ok: true`; returned map frozen and a different reference | `Object.isFrozen`; deepEqual input |
| T11 | lib-RN02-validate-rejects-each-error | lib | RN02 (−) | `null`, `'{"a":"KeyX"}'` (text), `[]`, `42`, `new Map()`; nes map + `c`; `JSON.parse('{"__proto__":…}')` own key; nes map without `start`; values `'keyx'`, `'Tab'`, `'Escape'`, `'F1'`, `'ShiftLeft'`, `''`, `42`; two buttons on `KeyZ` | `not-object` ×5; `unknown-button` ×2 (with `button`); `missing-button`; `invalid-code` ×7; `duplicate-code` | exact `error` value per input; `isKeyCode` false for each invalid code, true for `KeyX` only in exact case |
| T12 | lib-RN02-page-message-valid | lib | RN02 (+) | `parsePageMessage(toControlsMessage(nesDefault,'nes'),'nes')`; `inputMessage('nes','a',true)`; `{type:'RK_RELEASE_ALL'}`; `parseEmulatorMessage({type:'EMULATOR_CANVAS_READY'})` | same objects returned; `RK_INPUT` index 8 pressed true | deepEqual; `inputMessage('nes','c',true)` → `null` |
| T13 | lib-RN02-page-message-rejects-malformed | lib | RN02 (−) | string data; extra key; `console:'snes'` for `nes`; index `24`, `-1`, `1.5`, `'8'`; code `Tab`; 25 bindings; same code twice; 3-tuple binding; `pressed:'true'`; unknown `type`; `parseEmulatorMessage` with extra key or string | `null` for every input | one assertion per input |
| T14 | lib-RN02-console-id-picks-default-only-without-map | lib | RN02 (+/−) | `resolveControlMap(undefined, undefined, 'snes')`; `resolveControlMap(validSnesSaved, undefined, 'snes')` | default snes with `source:'default'`; saved map with `source:'player'` (id does not override it) | deepEqual map and `source` |
| T15 | lib-RN03-trusted-sender-accepted | lib | RN03 (+) | `isTrustedMessage({origin:O, source:W}, O, W)` with plain objects | `true` | equal true |
| T16 | lib-RN03-foreign-sender-rejected | lib | RN03 (−) | origin `https://evil.example`, `'null'`, `O + '/'`; source another object; expected source `null`/`undefined` with event source `null` | `false` in every case | equal false |
| T17 | lib-RN04-resolve-precedence | lib | RN04 (+) | (valid saved, valid admin); (invalid saved, valid admin); (junk, junk) for `nes` | `player`; `admin`; `default` | `source` and map deepEqual the winner |
| T18 | lib-RN04-saved-map-invalid-or-cleared | lib | RN04 (−) | saved `null` (after reset); saved map of `snes` resolved for `nes`; saved with a `Tab` value | falls back to `admin`/`default`, never `player` | `source` ≠ `player` |
| T19 | lib-RF06-emulator-html-contract-block | lib | RF06, RN01, RN02 | `public/emulator.html` text → `#rk-controls-contract` JSON | `consoles` = `BEZEL_CONSOLE_IDS`, `schemes` = `CONSOLE_SCHEMES`, `keyCodes` = `KEY_CODES`, `gamepad` = `GAMEPAD_LABELS`, `analog` = `ANALOG_INDICES` | deepEqual all five; block parses as JSON |
| T20 | lib-RF01-ejs-key-names (only if ledger `INPUT_PATH=boot`) | lib | RF01 | `EJS_KEY_NAMES` | one name per `KEY_CODES` entry (`KeyX`→`x`, `ArrowUp`→`up arrow`, `Enter`→`enter`) | key set = `KEY_CODES`; skipped and not created under `INPUT_PATH=listener` |
| T21 | frontend-RF02-legend-shows-console-keys | frontend | RF02 | 1366x768 fine, `routeBezel missing`, recorder, `mockGame` per 12 consoles; booting then running | chips = `legendGroups` labels with keycaps of the default map (nes: `D-pad [↑ ↓ ← →]`, `B [Z]`, `A [X]`, `Select [Space]`, `Start [Enter]`); Edit keys `aria-disabled` in booting, enabled in running | chip text per console; chip font-size 12px |
| T22 | frontend-RF02-legend-fit | frontend | RF02 | 1024x768 and 1366x768 fine, `routeBezel missing`, 12 consoles running | no chip clipped, Edit keys visible | row `scrollWidth ≤ clientWidth`; each chip rect inside the row rect; Edit keys height 40px, width ≥44px |
| T23 | frontend-RF02-legend-hidden-on-touch | frontend | RF02 | 390x844 and 844x390 touch, 1366x768 touch; running | legend row hidden; no Edit keys; no `<dialog>` open | `[data-slot=legend]` not visible; chip count 0 visible |
| T24 | frontend-RF01-RN02-map-sent-on-every-ready | frontend | RF01, RN02 (+) | 1366x768, `routeBezel missing`, recorder, nes; then Reload remount | iframe URL has `console=nes`; after each `EMULATOR_CANVAS_READY` recorder gets one `RK_CONTROLS` object = `toControlsMessage(DEFAULT_CONTROL_MAPS.nes,'nes')` | message `data` is an object, never a string; count 2 after Reload |
| T25 | frontend-RF01-RN01-fake-loader-keyboard | frontend | RF01, RN01 (+) | fake loader, consoles `nes`, `sms`, `gamegear`, `megadrive`, `n64`; keydown/keyup in the iframe | `EJS_controlScheme` `nes`/`segaMS`/`segaGG`/`segaMD`/`n64`; every `EJS_defaultControls[0][i].value` = `''`; `KeyZ` → `simulateInput(0, buttonIndex(b), 1)` then `0`; n64 `ArrowUp` → `(0,19,0x7fff)`; unbound `KeyP` → 0 calls; `event.repeat` → 0 extra calls | recorded call list; bound keydown `defaultPrevented` true |
| T26 | frontend-RF03-fake-loader-gamepad-config | frontend | RF03 | fake loader, each of the 12 consoles | `EJS_defaultControls[0][i].value2` = `GAMEPAD_LABELS[i]` for i 0..23; built-in virtual gamepad option set to off (option from spike S7) | deepEqual 24 entries per console |
| T27 | manual-RF03-physical-pad | manual | RF03 | 1 physical USB/Bluetooth pad on the spike page with the spike ROM (S6); `/play/<slug>` is not used (no game with a real ROM in `retrokey_e2e`) | south button, D-pad, Start and shoulders move the game with no setup | `build-ledger.md` `## Spike` S6 row: answer, EJS version, core, console |
| T28 | frontend-RN02-fake-loader-ignores-malformed | frontend | RN02 (−) | fake loader, nes running with default map; page posts `RK_CONTROLS` with index 24, code `Tab`, extra key, `console:'snes'`, string data | each ignored: `KeyZ` still → `simulateInput(0,0,1)`; no DOM text written | call list after each post; `console.warn` carries the type only |
| T29 | frontend-RN02-unknown-console-param | frontend | RN02 (−) | fake loader, iframe URL `console=xbox` and no `console` param | no `EJS_controlScheme`; built-in virtual gamepad option not set; `EJS_defaultControls` not written; `KeyZ` → 0 `simulateInput` calls | `window.EJS_controlScheme` undefined |
| T30 | frontend-RN03-foreign-window-ignored | frontend | RN03 (−) | (a) held stub: page itself posts `{type:'EMULATOR_CANVAS_READY'}` to `window`; (b) fake loader: iframe posts a valid `RK_INPUT` to itself | (a) status stays Starting game, no `RK_CONTROLS` sent; (b) 0 `simulateInput` calls | status text; recorder and call counts |
| T31 | frontend-RN03-same-origin-roundtrip | frontend | RN03 (+) | recorder records `event.origin` and `event.source === parent` for each message | every received message origin = app origin, source = parent; game reaches Running from the stub ready posted with `location.origin` | recorded origin/source flags; status `Running` |
| T32 | frontend-RF04-keys-panel-remap | frontend | RF04 | 1366x768, `routeBezel missing`, recorder, nes running; Edit keys → row A → press `KeyV` | dialog open with 5 rows; capture status "Press a key for A. Esc cancels."; then "Saved."; legend `A [V]` | new `RK_CONTROLS` binds `KeyV`→8; `localStorage['retrokey:controls:v1:nes']` parses to the new map |
| T33 | frontend-RF04-rejected-cancel-swapped | frontend | RF04 | capture on A: press `Tab`, `F1`, `ShiftLeft`; then `Escape`; capture on A, press `KeyZ` | "That key can't be used. Pick another." and capture continues; Escape returns to idle, map unchanged; "Z was on B; swapped." | legend shows `A [Z]`, `B [X]`; dialog still open after Escape in capture |
| T34 | frontend-RF04-RN04-remap-survives-reload | frontend | RF04, RN04 (+) | T32 remap, then `page.reload()` | legend `A [V]`; first `RK_CONTROLS` after ready binds `KeyV`; Reset enabled | recorder data; legend text |
| T35 | frontend-RN04-reset-restores-default | frontend | RN04 (+) | from T34, Reset to default | "Default keys restored."; legend `A [X]`; Reset disabled; storage key absent; new `RK_CONTROLS` = default | `localStorage.getItem` null; reload keeps default |
| T36 | frontend-RN04-bad-or-other-console-save-ignored | frontend | RN04 (−) | `addInitScript` sets nes key to `'{'`, to a map with `Tab`; remap on nes then open snes | default nes map shown and sent; snes legend = snes default | legend text; `RK_CONTROLS` bindings |
| T37 | frontend-RF04-no-storage | frontend | RF04 | `addInitScript` makes `localStorage.setItem` throw; remap A → `KeyV` | "Keys can't be saved in this browser."; legend `A [V]` for the session; new `RK_CONTROLS` sent | after reload legend back to default |
| T38 | frontend-RF04-focus-return-and-stability | frontend | RF04 | 1366x768 recorder; open panel, Done with Enter; reopen, Escape in idle | `document.activeElement` is the play iframe; recorder has no `Enter` keydown after Done | `[data-window]` box equal (0px) before open, while open and after close |
| T39 | frontend-RF04-keys-panel-a11y | frontend | RF04 | panel in idle (no saved map) and capture | 0 axe violations; `<dialog>` has `aria-labelledby`; status `role="status"`; Reset disabled in idle with no save | AxeBuilder; rows ≥44px high |
| T40 | frontend-RF05-controller-for-12-consoles | frontend | RF05 | 390x844 and 844x390 touch, recorder, `mockGame` per 12 consoles, running | controller visible; `[data-button]` count = `BUTTONS_BY_CONSOLE[id].length` (n64: minus the 4 hidden directions, other set after the D-pad/Stick toggle) | each `aria-label` = `buttonLabel`; each box ≥44x44 |
| T41 | frontend-RF05-controller-fit | frontend | RF05 | same matrix as T40 | portrait: no button rect intersects `[data-window]` or the status strip; landscape: overlap with `[data-window]` ≤24px | rect intersection per button |
| T42 | frontend-RF05-layout-stability-touch | frontend | RF05 | 390x844 and 844x390 touch: booting, running, after Dismiss; 1366x768 fine running | `[data-window]` box equal (0px) across the states and equal to the SF04 rule (largest `--t-ar` box in the stage) | `getBoundingClientRect` delta 0 |
| T43 | frontend-RF05-touch-input-roundtrip | frontend | RF05 | 390x844 touch; booting then running; pointerdown/up on `[data-button=a]`; pointerdown then pointercancel on `up` | booting: `aria-disabled`, 0 `RK_INPUT`; running: `RK_INPUT {index: buttonIndex, pressed:true}` then `false`; cancel → `pressed:false` | recorder sequence |
| T44 | frontend-RF05-rotate-hint | frontend | RF05 | touch 390x844, then 844x390; Dismiss in 390x844, reload | text "Turn your phone sideways for a bigger game." visible in 390x844, absent in 844x390; after Dismiss hidden, stays hidden after reload in the same session | visibility; Dismiss ≥44x44 |
| T45 | frontend-RF05-fullscreen-toggle | frontend | RF05 | 390x844 touch and 1366x768 fine (`routeBezel missing`); click twice | button in `data-slot="fullscreen"`, `aria-pressed` `false` → `true` (`document.fullscreenElement` = play-stage) → `false` | attribute and label "Full screen"/"Exit full screen"; box ≥44x44 |
| T46 | frontend-RF05-controller-legend-a11y | frontend | RF05, RF02 | controller running at 390x844 touch; legend running at 1366x768 | 0 axe violations | AxeBuilder (`target-size`, `color-contrast`); touch buttons `transition-duration` 0s |
| T47 | lib-RF06-console-id-from-system | lib | RF06 | `consoleIdForSystem` on `'Master System'`, `'sms'` (legacy alias via `resolveEmulatorSystem`), `'Xbox'`, `''`, `null` | `sms`, `sms`, `null`, `null`, `null` | deepEqual; result never depends on a theme override |
| T48 | frontend-RF01-fake-loader-no-input-api | frontend | RF01 | fake loader without `simulateInput`, nes running; `KeyZ` keydown | key not `defaultPrevented`; no page error; one `[rk] input API missing` warn | console warn count 1; `pageerror` count 0 |
| T49 | frontend-RF02-RF05-empty-states | frontend | RF02, RF05 | 1366x768 fine (`routeBezel missing`) and 390x844 touch; unknown slug (not-found) and real emulator with no ROM (failed) | legend row present, 40px, with 0 chips and no Edit keys; controller and rotate hint hidden | chip count 0; `[data-button]` count 0; row height 40px |
| T50 | frontend-RF02-RF05-narrow-desktop | frontend | RF02, RF05 | 768x1024 fine pointer (no touch), nes running | no legend, no Edit keys, no controller; fullscreen button present; default keys still reach the iframe (`KeyZ` → recorder keydown) | `[data-slot=legend]` and `[data-slot=touch-overlay]` not visible; recorder keys contain `KeyZ` |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| lib (controls module + contract block) | `tests/emulator-controls.test.ts` (new; add to `validation_gates.test` in AGENTS.md) | T01-T20, T47 |
| frontend (play screen) | `e2e/play-screen.qa.spec.ts` (existing; stubs post with `location.origin`; add `stubEmulatorRecorder`, `received`, `routeFakeEjsLoader`; `routeBezel` in every Wide test) | T21-T26, T28-T46, T48, T49, T50 |
| manual (physical pad) | `subfeatures/SF02-emulator-controls/build-ledger.md` `## Spike` row S6 | T27 |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|----------|
| RF01 | T01, T02, T20, T24, T25, T48 | ✅ |
| RF02 | T03, T21, T22, T23, T46, T49, T50 | ✅ |
| RF03 | T04, T26, T27 (manual) | ✅ |
| RF04 | T05, T06, T32, T33, T34, T37, T38, T39 | ✅ |
| RF05 | T40, T41, T42, T43, T44, T45, T46, T49, T50 | ✅ |
| RF06 | T07, T19, T47 | ✅ |
| RN01 | (+) T08, T25 · (−) T09 | ✅ |
| RN02 | (+) T10, T12, T14, T24 · (−) T11, T13, T14, T28, T29 | ✅ |
| RN03 | (+) T15, T31 · (−) T16, T30 | ✅ |
| RN04 | (+) T17, T34, T35 · (−) T18, T36 | ✅ |
| Metric: 12/12 systems with own map | T01, T02 | ✅ |
| Metric: MS/GG with `segaMS` | T08, T25 (gamegear = `segaGG`, owner plan S5) | ✅ |
| Metric: virtual controller visible 390x844, 12/12 | T40 | ✅ |
| Metric: keyboard on + legend keys at 1366x768 | T21, T25 | ✅ |
| Metric: gamepad (mock of `navigator.getGamepads`) | replaced per Frontend → Resolved questions OQ-1: T04 + T26 + T27 (manual); a `getGamepads` mock proves nothing with the stub or the fake loader | ✅ (OQ-1 aceito pelo dono, 2026-11-09) |
| Metric: fullscreen present; rotate hint 390x844 yes / 844x390 no | T44, T45 | ✅ |
| Metric: remap survives reload; reset restores | T34, T35 | ✅ |
| Metric: foreign origin or window ignored | T16, T30 | ✅ |
| Design Contract: Legend fit, Controller fit, Layout stability, Focus return | T22, T41, T38 + T42, T38 | ✅ |

Coverage: 10/10 RF/RN (100%) · 8/8 success metrics (gamepad metric through T04 + T26 + manual T27).

---

## Frontend

SF02 emulator-controls. Layout, geometry, tokens, states and copy: `subfeatures/SF02-emulator-controls/design.md` (Screens, Components, Flows, Tokens, Design Contract). This plan fixes files, signatures, the page ↔ iframe protocol and the spike. No new route, no data-fetching library, no store: local `useState` like the SF01/SF04 play stage. No backend in SF02 (types mirror nothing). No new npm dependency.

### Architecture decisions (frontend)
| # | Decision | Why |
|---|---|---|
| FD1 | One pure module `lib/emulator-controls.ts` (no React, no fs, no DOM globals at import) holds buttons, key codes, default maps, EJS index table, gamepad labels, schemes, validation, resolution, storage key/parse and the message contracts. Imports `BezelConsoleId`/`BEZEL_CONSOLE_IDS` from `lib/bezel-console.ts`, `DEFAULT_PLAY_THEMES` from `lib/play-theme.ts` and `resolveEmulatorSystem` from `lib/emulator-cores.ts` (all unchanged). | RF06, SF03 imports it from server routes and client components; console ids defined once. |
| FD2 | Keyboard path = **listener path**: `public/emulator.html` listens to `keydown`/`keyup` (capture, `window`) inside the iframe, maps `event.code` through the bindings it received, calls `EJS_emulator.gameManager.simulateInput(0, index, value)` and `preventDefault()`. EmulatorJS keyboard `value` is left empty for every index. | A live remap is a plain object swap in the iframe, so "does writing `EJS_emulator.controls` at runtime work" stops mattering; the `KeyboardEvent.code` → EJS key-name table is needed only by the fallback. Same `simulateInput` call the virtual controller needs anyway. |
| FD3 | Fallback (only if the spike shows FD2 fails, e.g. EJS still binds its own default keys when `value` is empty and they cannot be cleared): **boot path** — `EJS_defaultControls[0][i].value = EJS_KEY_NAMES[code]` written before `loader.js`; a remap remounts the iframe (`bootKey`). Decision recorded as `INPUT_PATH` in the build ledger. | Keeps RN02 (closed lists) either way; costs a reboot per remap. |
| FD4 | Gamepad (RF03) stays native to EmulatorJS: emulator.html writes `value2 = GAMEPAD_LABELS[i]` for all 24 indices before `loader.js`. Not remappable (RF04 is keys only). | EmulatorJS already polls `navigator.getGamepads`; a second poller would double-fire. |
| FD5 | Console id reaches emulator.html as a new URL param `console` (allowlisted to the 12 ids; anything else → no scheme, no listener map, EmulatorJS defaults). The map travels only by `postMessage`. | `EJS_controlScheme` must be set before `loader.js` and MS/GG share `genesis_plus_gx` with Mega Drive, so the core cannot choose it (RN01); the iframe URL is already the boot input and changes per attempt. A message would need a pre-boot handshake. |
| FD6 | emulator.html cannot import TS, so it carries one inline `<script type="application/json" id="rk-controls-contract">` block (console ids, schemes, key codes, gamepad labels, analog indices). A node:test reads the HTML and deep-equals the block with the module exports. | One source of truth, drift caught by the test gate. |
| FD7 | Both directions use target origin `window.location.origin`, never `'*'`; both receivers check `event.origin === location.origin` and `event.source` is the expected window (page: `iframe.contentWindow`; iframe: `window.parent`) (RN03). | discovery.md postMessage risk. |
| FD8 | Built-in EmulatorJS virtual gamepad off (epic Notes 2026-11-09); the RetroKey `VirtualController` posts `RK_INPUT`. Option name decided by the spike, CSS hide as last resort. | Measurable 12/12 with the stub (epic Notes). |

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| `/play/[slug]` | `app/play/[slug]/page.tsx` (unchanged) → `PlayStage` | legend + Keys panel (Wide), virtual controller + rotate hint (touch), fullscreen (all) — design.md Screens |

### Components
{"ControlsLegend":{"location":"components/ControlsLegend.tsx","purpose":"NEW: chips from legendGroups + keyCapLabel; Edit keys; mounted in data-slot=legend"},"KeysPanel":{"location":"components/KeysPanel.tsx","purpose":"NEW: native <dialog> showModal; capture/rejected/swapped/saved/reset/no-storage; Esc in capture = cancel event preventDefault"},"VirtualController":{"location":"components/VirtualController.tsx","purpose":"NEW: per-console clusters from BUTTONS_BY_CONSOLE; pointer events, D-pad pointer capture, release-all on pointercancel/blur/visibilitychange/orientationchange; N64 stick|dpad local toggle; renders RotateHint"},"RotateHint":{"location":"components/RotateHint.tsx","purpose":"NEW: portrait-only pill (CSS orientation:portrait), Dismiss"},"FullscreenToggle":{"location":"components/FullscreenToggle.tsx","purpose":"NEW: requestFullscreen on play-stage, try orientation.lock, aria-pressed synced on fullscreenchange; null when !document.fullscreenEnabled"},"useControlMap":{"location":"components/useControlMap.ts","purpose":"NEW: resolved map + localStorage read/write/remove for one console"},"PlayStage":{"location":"components/","purpose":"mounts the new components in the existing slots; owns keysOpen, emulatorRef, stageRef; window box unchanged"},"PlayTopBar":{"location":"components/","purpose":"unchanged file; receives FullscreenToggle as children"},"Emulator":{"location":"components/","purpose":"forwardRef + EmulatorHandle; console URL param; trusted-message check; sends RK_CONTROLS on every EMULATOR_CANVAS_READY and on map change; target origin = location.origin"},"emulator.html":{"location":"public/emulator.html","purpose":"protocol receiver (see emulator.html protocol); per-core branches replaced by console-param scheme"}}

### Exported signatures (exact) — `lib/emulator-controls.ts`
| Export | Contract |
|---|---|
| `EJS_INDEX` | `{ B:0, Y:1, SELECT:2, START:3, UP:4, DOWN:5, LEFT:6, RIGHT:7, A:8, X:9, L:10, R:11, L2:12, R2:13, L3:14, R3:15, LSTICK_RIGHT:16, LSTICK_LEFT:17, LSTICK_DOWN:18, LSTICK_UP:19, RSTICK_RIGHT:20, RSTICK_LEFT:21, RSTICK_DOWN:22, RSTICK_UP:23 } as const` (spike S3) |
| `EjsIndex` | `(typeof EJS_INDEX)[keyof typeof EJS_INDEX]` |
| `ANALOG_INDICES` / `ANALOG_MAX` | `readonly EjsIndex[]` = 16..23 / `0x7fff` (pressed analog value; digital = 1, release = 0) |
| `CONSOLE_BUTTONS` / `ConsoleButton` | `['up','down','left','right','stick-up','stick-down','stick-left','stick-right','a','b','c','d','x','y','l','r','l1','l2','r1','r2','z','c-up','c-down','c-left','c-right','1','2','square','triangle','cross','circle','select','start','coin'] as const` / its element union. Directions are atomic; grouping is a view concern. |
| `BUTTONS_BY_CONSOLE` | `Record<BezelConsoleId, readonly ConsoleButton[]>` — closed list per console = design.md "Botões por console" table, in that order (Arcade/Neo Geo "Stick" = `up/down/left/right`; N64 Stick = `stick-*`, D-pad = `up..right`, C = `c-*`) |
| `buttonLabel` | `(consoleId: BezelConsoleId, button: ConsoleButton) => string` — display label ("Pause" for `start` on `sms`) |
| `ButtonGroup` / `legendGroups` | `{ label: string; buttons: readonly ConsoleButton[] }` / `(consoleId: BezelConsoleId) => readonly ButtonGroup[]` — D-pad, Stick and the four C each collapse into one group (design.md C4); every other button is its own group |
| `BUTTON_INDEX` | `Record<BezelConsoleId, Partial<Record<ConsoleButton, EjsIndex>>>` — every button in `BUTTONS_BY_CONSOLE[id]` has an entry. Provisional RetroPad mapping, verified per row in spike S3/S4: NES/GB/GBC `b→B a→A select→SELECT start→START`, GBA + `l→L r→R`; SNES `b→B y→Y a→A x→X l r`; SMS/GG `1→B 2→A start→START`; MD `a→Y b→B c→A`; PS `cross→B circle→A square→Y triangle→X l1→L r1→R l2→L2 r2→R2`; N64 `a→B b→Y z→L2 l r start stick-*→LSTICK_* c-*→RSTICK_*`; Arcade/Neo Geo `a→B b→A c→Y d→X coin→SELECT start→START`; directions → UP..RIGHT |
| `buttonIndex` | `(consoleId: BezelConsoleId, button: ConsoleButton) => EjsIndex \| null` |
| `KEY_CODES` / `KeyCode` | closed `as const` list of `KeyboardEvent.code`: `KeyA`–`KeyZ`, `Digit0`–`Digit9`, `Numpad0`–`Numpad9`, `NumpadEnter`, `ArrowUp/Down/Left/Right`, `Enter`, `Space`, `Backspace`, `Comma`, `Period`, `Slash`, `Semicolon`, `Quote`, `BracketLeft`, `BracketRight`, `Minus`, `Equal`, `Backslash`, `Backquote`, `Insert`, `Delete`, `Home`, `End`, `PageUp`, `PageDown`. Excludes `Tab`, `Escape`, `F1`–`F12`, Shift/Control/Alt/Meta (L/R), `CapsLock`, `ContextMenu` (design.md Keys panel `rejected`) |
| `isKeyCode` | `(value: unknown) => value is KeyCode` (exact, case-sensitive) |
| `keyCapLabel` | `(code: KeyCode) => string` — `KeyX`→`X`, `Digit5`→`5`, `ArrowUp`→`↑`, `Enter`→`Enter`, `Space`→`Space` |
| `ControlMap` | `Readonly<Partial<Record<ConsoleButton, KeyCode>>>` — after validation it holds exactly the console's buttons |
| `DEFAULT_CONTROL_MAPS` | `Record<BezelConsoleId, ControlMap>` (RF01). Directions `Arrow*`; `select→Space`, `start→Enter`; NES/GB/GBC `b→KeyZ a→KeyX`; GBA + `l→KeyQ r→KeyW`; SNES `b→KeyZ a→KeyX y→KeyA x→KeyS l→KeyQ r→KeyW`; SMS/GG `1→KeyZ 2→KeyX` (RN01); MD `a→KeyZ b→KeyX c→KeyC`; PS `cross→KeyZ circle→KeyX square→KeyA triangle→KeyS l1→KeyQ r1→KeyW l2→KeyE r2→KeyR`; N64 `stick-*→Arrow*`, D-pad `up→KeyI down→KeyK left→KeyJ right→KeyL`, `c-up→KeyT c-down→KeyG c-left→KeyF c-right→KeyH a→KeyX b→KeyZ z→KeyE l→KeyQ r→KeyW`; Arcade/Neo Geo `a→KeyZ b→KeyX c→KeyA d→KeyS coin→Digit5`. Each default passes `validateControlMap` (unit test, 12/12). |
| `EjsControlScheme` / `CONSOLE_SCHEMES` | `'nes'\|'snes'\|'n64'\|'gb'\|'gba'\|'segaMS'\|'segaGG'\|'segaMD'\|'psx'\|'arcade'` / `Record<BezelConsoleId, EjsControlScheme>` — `sms→segaMS`, `gamegear→segaGG`, `megadrive→segaMD`, `dmg`/`gbc→gb`, `neogeo`/`arcade→arcade`, `ps→psx`, rest by name (spike S5) |
| `GAMEPAD_LABELS` | `Readonly<Record<EjsIndex, string>>` — `0 BUTTON_2, 1 BUTTON_4, 2 SELECT, 3 START, 4 DPAD_UP, 5 DPAD_DOWN, 6 DPAD_LEFT, 7 DPAD_RIGHT, 8 BUTTON_1, 9 BUTTON_3, 10 LEFT_TOP_SHOULDER, 11 RIGHT_TOP_SHOULDER, 12 LEFT_BOTTOM_SHOULDER, 13 RIGHT_BOTTOM_SHOULDER, 14 LEFT_STICK, 15 RIGHT_STICK, 16 LEFT_STICK_X:+1, 17 LEFT_STICK_X:-1, 18 LEFT_STICK_Y:+1, 19 LEFT_STICK_Y:-1, 20–23 RIGHT_STICK_*` same order (spike S6) |
| `EJS_KEY_NAMES` | `Readonly<Record<KeyCode, string>>` — FD3 fallback only (`KeyX`→`'x'`, `ArrowUp`→`'up arrow'`, `Enter`→`'enter'`, ...). Exported and tested only if the ledger records `INPUT_PATH=boot`; otherwise not created. |
| `ControlMapError` / `ControlMapResult` | `'not-object'\|'unknown-button'\|'missing-button'\|'invalid-code'\|'duplicate-code'` / `{ ok: true; map: ControlMap } \| { ok: false; error: ControlMapError; button?: ConsoleButton }` |
| `validateControlMap` | `(input: unknown, consoleId: BezelConsoleId) => ControlMapResult` — plain object only (prototype `Object.prototype` or `null`), own keys only, keys ⊆ `BUTTONS_BY_CONSOLE[id]` and = it, values `isKeyCode`, no code twice. Returns a fresh frozen copy. Reused by SF03 (RF06). |
| `resolveControlMap` | `(saved: unknown, adminMap: unknown, consoleId: BezelConsoleId) => { map: ControlMap; source: 'player' \| 'admin' \| 'default' }` — first that validates wins: player > admin > `DEFAULT_CONTROL_MAPS[id]` (RN04). SF02 passes `adminMap = undefined`. |
| `applyRemap` | `(map: ControlMap, consoleId: BezelConsoleId, button: ConsoleButton, code: KeyCode) => { map: ControlMap; swappedWith: ConsoleButton \| null }` — if another button holds `code`, the two swap (design.md `swapped`); result always validates |
| `CONTROLS_STORAGE_PREFIX` / `controlsStorageKey` | `'retrokey:controls:v1:'` / `(consoleId: BezelConsoleId) => string` |
| `parseSavedControlMap` / `serializeControlMap` | `(raw: string \| null, consoleId: BezelConsoleId) => ControlMap \| null` (JSON.parse in try, then `validateControlMap`; invalid → null) / `(map: ControlMap) => string` |
| `RkControlsMessage` | `{ type: 'RK_CONTROLS'; console: BezelConsoleId; bindings: ReadonlyArray<readonly [KeyCode, EjsIndex]> }` — page → iframe |
| `RkInputMessage` / `RkReleaseAllMessage` | `{ type: 'RK_INPUT'; index: EjsIndex; pressed: boolean }` / `{ type: 'RK_RELEASE_ALL' }` — page → iframe |
| `PageToEmulatorMessage` / `EmulatorToPageMessage` | union of the three above / `{ type: 'EMULATOR_CANVAS_READY' }` (unchanged name; no "controls applied" reply — nothing on the page would read it) |
| `toControlsMessage` | `(map: ControlMap, consoleId: BezelConsoleId) => RkControlsMessage` — one binding per button via `BUTTON_INDEX` |
| `inputMessage` | `(consoleId: BezelConsoleId, button: ConsoleButton, pressed: boolean) => RkInputMessage \| null` |
| `parsePageMessage` | `(data: unknown, consoleId: BezelConsoleId) => PageToEmulatorMessage \| null` — the reference of the check emulator.html runs inline: exact key sets, `type` in the 3, `console === consoleId`, `bindings` array ≤ 24, each a 2-tuple `[isKeyCode, integer 0..23]`, no code twice; `index` integer 0..23, `pressed` boolean |
| `parseEmulatorMessage` | `(data: unknown) => EmulatorToPageMessage \| null` |
| `isTrustedMessage` | `(event: { origin: string; source: unknown }, expectedOrigin: string, expectedSource: unknown) => boolean` — `expectedSource != null && event.source === expectedSource && event.origin === expectedOrigin` (RN03; node:test with plain objects) |
| `consoleIdForSystem` | `(system?: string \| null) => BezelConsoleId \| null` — `resolveEmulatorSystem(system)` → `DEFAULT_PLAY_THEMES[resolved].frame`; `null` for an unknown or empty system. Never reads a theme override. Reused by SF03 RF04 to pick the console profile (cross-SF review). |

### Exported signatures (exact) — components
| File | Export |
|---|---|
| `components/useControlMap.ts` | `export type ControlMapState = { map: ControlMap \| null; hasSaved: boolean; storageOk: boolean; remap: (button: ConsoleButton, code: KeyCode) => void; reset: () => void }` ; `export default function useControlMap(consoleId: BezelConsoleId \| null): ControlMapState` — `map` null when `consoleId` null; first render = `DEFAULT_CONTROL_MAPS[id]` (SSR-safe); effect on `[consoleId]` reads `localStorage.getItem(controlsStorageKey(id))` → `resolveControlMap(parseSaved..., undefined, id)`; `remap` = `applyRemap` + `setItem`; `reset` = `removeItem` + resolved map; every storage call in try/catch → `storageOk=false`, map kept in state (design.md `no-storage`) |
| `components/ControlsLegend.tsx` | `interface ControlsLegendProps { consoleId: BezelConsoleId \| null; map: ControlMap \| null; status: PlayScreenState; onEdit: () => void; editButtonRef: RefObject<HTMLButtonElement> }` ; default export `ControlsLegend` — renders nothing inside the row when `consoleId`/`map` null or status not booting/running |
| `components/KeysPanel.tsx` | `interface KeysPanelProps { consoleId: BezelConsoleId; map: ControlMap; hasSaved: boolean; storageOk: boolean; open: boolean; onRemap: (button: ConsoleButton, code: KeyCode) => void; onReset: () => void; onClose: () => void }` ; default export. Capture reads `event.code`; `Escape` → `cancel` event with `preventDefault`, back to idle; any other `!isKeyCode` → rejected; swap target found from `map` before `onRemap` (status copy) |
| `components/VirtualController.tsx` | `interface VirtualControllerProps { consoleId: BezelConsoleId; status: PlayScreenState; onInput: (button: ConsoleButton, pressed: boolean) => void }` ; default export. Hidden unless status booting/running; booting = `aria-disabled`, no `onInput`. Each button `aria-label={buttonLabel(...)}`, `data-button={button}` (E2E hook) |
| `components/RotateHint.tsx` | `interface RotateHintProps { onDismiss: () => void }` ; default export. Dismissed flag lives in VirtualController, persisted in `sessionStorage['retrokey:rotate-hint-dismissed']` (try/catch) |
| `components/FullscreenToggle.tsx` | `interface FullscreenToggleProps { targetRef: RefObject<HTMLElement> }` ; default export |
| `components/Emulator.tsx` | `export type EmulatorHandle = { sendInput: (index: EjsIndex, pressed: boolean) => void; releaseAll: () => void; focusGame: () => boolean }` ; `interface EmulatorProps` adds `consoleId?: BezelConsoleId \| null; controls?: RkControlsMessage \| null` (optional; absent behaves as `null`, so the existing `PlayStage` call still typechecks after Task 5) ; `export default forwardRef<EmulatorHandle, EmulatorProps>(function Emulator(...))`. `focusGame` = `iframeRef.current?.contentWindow?.focus()`, false when no iframe. URL params gain `console` only when `consoleId` non-null. Message listener first runs `isTrustedMessage(event, location.origin, iframeRef.current?.contentWindow)` then `parseEmulatorMessage`. `EmulatorStatus` unchanged. |
| `PlayStage`, `PlayTopBar`, `StatusStrip`, `ThemedFrame` | props and exports unchanged |

### public/emulator.html protocol
- **Boot input (URL):** `title`, `core`, `rom` (unchanged) + `console` (FD5). `console` ∉ contract block ids → no `EJS_controlScheme`, no listener bindings, built-in EJS defaults (today's fallback branch). The per-core `if` branches (lines 47-121) are removed. With no valid console: `EJS_defaultControls` is not written (EmulatorJS keyboard defaults stay) and the built-in virtual gamepad is NOT turned off, so it is the touch input for unknown systems; the S7 option is applied only when `console` is one of the 12 ids (cross-SF review).
- **Before `loader.js`:** `EJS_controlScheme = schemes[console]`; `EJS_defaultControls = {0..3: {}}` with player 0 `{ [i]: { value: '', value2: gamepad[i] } }` for i 0..23 (FD2/FD4); built-in virtual gamepad off by the option the spike confirms (S7); `EJS_defaultOptions.keyboardInput/altKeyboardInput = 'disabled'` kept.
- **Receive:** one `message` listener. Drop unless `event.origin === location.origin && event.source === window.parent`. Re-check the shape exactly like `parsePageMessage` (inline, no eval, no string ever written to DOM or HTML): exact key set, `type` ∈ {`RK_CONTROLS`,`RK_INPUT`,`RK_RELEASE_ALL`}, `console` equals the URL console, codes ∈ contract `keyCodes`, indices `Number.isInteger` and 0..23, ≤ 24 bindings, no code twice. Invalid → ignored silently (one `console.warn` with the type only).
- **Apply:** `RK_CONTROLS` → replace the in-memory `Map<code, index>` (live, any time; before the first one arrives keys do nothing — the page sends it on `EMULATOR_CANVAS_READY`). Listener: `keydown` (ignore `event.repeat`) / `keyup` on `window`, capture phase; bound code → `simulateInput(0, index, down ? (analog.includes(index) ? 0x7fff : 1) : 0)` + `preventDefault()`; unbound keys pass through. `RK_INPUT` → same call. `RK_RELEASE_ALL` and `window` `blur` → value 0 for every pressed index. Calls guarded: when `typeof window.EJS_emulator?.gameManager?.simulateInput !== 'function'`, the key is not handled (no `preventDefault`, nothing recorded as pressed), one `console.warn('[rk] input API missing')` is logged once per page, and `RK_INPUT` is dropped. No retry, no error UI (accepted degradation: the player sees a running game that ignores input) (cross-SF review).
- **Send:** `window.parent.postMessage({ type: 'EMULATOR_CANVAS_READY' }, location.origin)` (was `'*'`).
- **Contract block:** `<script type="application/json" id="rk-controls-contract">{"consoles":[...12],"schemes":{...},"keyCodes":[...],"gamepad":{...24},"analog":[16..23]}</script>`, parsed once with `JSON.parse(document.getElementById(...).textContent)` (FD6).

### Hooks & State
{"hooks":{"useWideScreen":"unchanged; not used by SF02 (legend visibility stays the CSS slot class 'hidden h-10 shrink-0 wide:block')","useControlMap":"useControlMap(consoleId) → {map, hasSaved, storageOk, remap, reset}"},"stores":"none","PlayStage local state":{"consoleId":"ready ? consoleIdForSystem(system) : null — derived from the game's system, not from theme.frame, so an SF03 per-game frame override never changes the controls (cross-SF review). The bezel keeps its own expression (theme.frame !== 'neutral' ? theme.frame : null), unchanged","controls":"useControlMap(consoleId)","controlsMessage":"useMemo(() => consoleId && controls.map ? toControlsMessage(controls.map, consoleId) : null, [consoleId, controls.map])","keysOpen":"useState(false); Edit keys → true; KeysPanel onClose → false then focus return","emulatorRef":"useRef<EmulatorHandle>(null) passed as ref to <Emulator key={bootKey}>","stageRef":"useRef<HTMLDivElement>(null) on data-testid=play-stage, given to FullscreenToggle","editButtonRef":"useRef<HTMLButtonElement>(null) given to ControlsLegend"},"map delivery":"Emulator keeps controls in a ref; on every trusted EMULATOR_CANVAS_READY (each core attempt and each Reload remount) it posts RK_CONTROLS to that iframe; an effect on [controls] posts again while running (remap/reset, live per FD2)","input flow":"VirtualController onInput(button, pressed) → PlayStage handleInput: idx = buttonIndex(consoleId, button); idx !== null && emulatorRef.current?.sendInput(idx, pressed) → Emulator posts RK_INPUT to iframe.contentWindow with target location.origin → emulator.html simulateInput","release":"VirtualController releases its own pressed buttons on pointercancel/blur/visibilitychange/orientationchange; PlayStage calls emulatorRef.current?.releaseAll() when keysOpen becomes true and on unmount","focus return":"handleKeysClose: setKeysOpen(false); if a key is down, wait for the next window keyup, then requestAnimationFrame → emulatorRef.current?.focusGame() || editButtonRef.current?.focus() (design.md C6)","slots":"legend div gets <ControlsLegend>; touch-overlay div gets <VirtualController> when consoleId !== null (overlay stays pointer-events-none, buttons pointer-events-auto); <KeysPanel> rendered after the slots only when consoleId && controls.map; PlayTopBar children = <FullscreenToggle targetRef={stageRef}/>"}

### SPIKE (task 1, manual, before any SF02 code)
- **Setup without Mongo and without touching `.env.local`:** owner copies 1 ROM into `public/roms/` (gitignored, `.gitignore:32`; checked with `git check-ignore`). The spike page is a copy of `public/emulator.html` at `public/roms/emulator-spike.html` (same folder, also never committed), edited by hand to set the globals under test. Open `http://localhost:3001/roms/emulator-spike.html?core=<core>&rom=/roms/<file>&title=Spike` directly — no `/play`, no `/api/game`, no `/api/rom`. Recommended ROM: Master System or Game Gear (covers S5, the riskiest rule RN01, and `genesis_plus_gx`).
- **Checklist (each answer → decision):**

| # | Fact to verify on EmulatorJS `stable` | Decides |
|---|---|---|
| S1 | `window.EJS_emulator.gameManager.simulateInput(0, i, 1/0)` from DevTools moves the game | FD2 viable; if not → blocker, VirtualController has no input API (stop, owner) |
| S2 | With `value: ''` for every index, EJS binds no keyboard key of its own; a capture `keydown` listener on the iframe `window` sees `event.code` while the canvas has focus | `INPUT_PATH=listener`; else `INPUT_PATH=boot` (FD3) and test `'x'` vs `'KeyX'` vs `'ArrowUp'` vs `'up arrow'` names to build `EJS_KEY_NAMES` |
| S3 | Index meaning on the spike core: 0 B, 8 A, 2 Select, 3 Start, 4-7 D-pad (and 16-19 analog with 0x7fff, if the ROM's core reads it) | `EJS_INDEX` and the spike console's `BUTTON_INDEX` row; other rows stay "provisional", checked in build QA with any ROM the owner has |
| S4 | MD 3-button order on `genesis_plus_gx` (`a→Y b→B c→A`) — only if the ROM is MD | `BUTTON_INDEX.megadrive` |
| S5 | `EJS_controlScheme = 'segaMS'` / `'segaGG'` accepted (no console error; EJS controls menu shows 2 buttons) | `CONSOLE_SCHEMES`; if refused → scheme omitted for that console, RN01 kept by our own 2-button map |
| S6 | A physical pad (1 owner pad): south button fires index 0 with `value2 'BUTTON_2'` or `'BUTTON_1'`; D-pad and shoulders labels | `GAMEPAD_LABELS`; RF03 manual evidence |
| S7 | Option that turns the built-in touch gamepad off (candidates: `EJS_defaultOptions['virtual-gamepad']='disabled'`, absence of `EJS_VirtualGamepadSettings`, `EJS_VirtualGamepad=false`) with DevTools touch emulation 390×844 | emulator.html boot line; last resort CSS `display:none` on the EJS virtual-gamepad container |
| S8 | Writing `EJS_emulator.controls` at runtime takes effect | informational only under `INPUT_PATH=listener` |

- **Record:** `subfeatures/SF02-emulator-controls/build-ledger.md`, section `## Spike`, one row per S#: answer, EJS version string (`EJS_emulator.version` or loader banner), core, ROM console (not the file name), decision. Keep `public/roms/emulator-spike.html` (gitignored) until Task 11 (T27), then delete it.

### E2E impact (e2e/play-screen.qa.spec.ts)
- Stubs `stubEmulatorReady`/`stubEmulatorHeld` post with `location.origin` (not `'*'`). New `stubEmulatorRecorder(page)`: stub that posts ready, records every received `message` `data` and every `keydown` `code` into `window.__rk`; helper `received(page)` reads it through the iframe. Every Wide test keeps `routeBezel` (owner rule).
- New `routeFakeEjsLoader(page)`: `page.route` on `https://cdn.emulatorjs.org/stable/data/loader.js` → script that adds a `<canvas>` and sets `window.EJS_emulator = { gameManager: { simulateInput } }` recording calls; `/api/rom/**` → small bytes. Runs the **real** emulator.html: scheme per console (`segaMS` for sms, `segaGG` for gamegear), `value2` table, built-in gamepad option set, `KeyZ` → `simulateInput(0, idx, 1)` then 0, N64 stick → `0x7fff`, malformed `RK_CONTROLS` (index 24, `Tab`, extra key, wrong console, string data) ignored. Also the RF03 evidence on the page side (config handed to EJS); the real pad stays manual (S6).
- Touch 390×844 and 844×390 (`hasTouch`, `isMobile`), parametrized over the 12 systems with `mockGame(page, system)` (`page.route` on `**/api/game/**`): controller visible, `[data-button]` count = `BUTTONS_BY_CONSOLE` length, Controller fit (no intersection with `[data-window]` or the strip in portrait; ≤ 24px over the window in landscape), window box equal with and without SF02, rotate hint visible in 390×844 / absent in 844×390, Dismiss hides it; press/release of one button → recorder has `RK_INPUT` pressed true then false with `buttonIndex`; booting = inert (no `RK_INPUT`).
- Legend 1024×768 and 1366×768, 12 systems: `scrollWidth ≤ clientWidth`, each chip inside the row, Edit keys visible; touch → legend hidden.
- Keys panel 1366×768: remap → legend updates and recorder gets a new `RK_CONTROLS`; reload → map kept (localStorage); Reset → default back and key removed; `Tab`/`F1`/`ShiftLeft` rejected copy; `Escape` in capture cancels back to idle with the map unchanged; swap copy; no-storage via `page.addInitScript` making `localStorage.setItem` throw; Done with Enter → `document.activeElement` is the iframe and recorder has no `Enter` keydown; axe in idle and capture.
- Fullscreen: button in `data-slot="fullscreen"` at 390×844 and 1366×768, `aria-pressed` toggles on click (Chromium headless supports the API).
- Unit (`tests/emulator-controls.test.ts`, added to the AGENTS.md test gate): 12/12 defaults validate; MS/GG lists are exactly D-pad, 1, 2, Start and their scheme is segaMS/segaGG; every `validateControlMap` error; resolve order; `applyRemap` swap; parse of junk storage; `parsePageMessage` rejects every malformed case; `isTrustedMessage` false for foreign origin, foreign source, null expected source; drift test of the emulator.html contract block.

### Resolved questions (owner, plan preview 2026-11-09)
- OQ-1: about.md metric "Gamepad simulado (mock de `navigator.getGamepads`) aciona o botão mapeado — E2E": with the stub (and with the fake loader) no EmulatorJS polls the pad, so a getGamepads mock proves nothing. Plan replaces it with: unit on `GAMEPAD_LABELS` + fake-loader E2E on `value2` + manual S6 with 1 pad. Accepted.
- OQ-2: spike ROM = Master System or Game Gear (owner confirmed). `BUTTON_INDEX` rows for the other consoles stay provisional until a ROM of each is run in build QA.
- OQ-3: default keys above (Space = Select, Digit5 = Coin, N64 D-pad on IJKL) confirmed by the owner; design.md fixes buttons, not keys.

Reference: `public/emulator.html` (lines 36-133 boot globals, 154-184 ready signal), `components/Emulator.tsx` (message listener 177-193), `components/PlayStage.tsx` (slots 128-130, bezelId 53), `components/PlayTopBar.tsx` (fullscreen cell 32-34), `lib/bezel-console.ts` (ids, guard), `lib/play-theme.ts` (pure-module pattern, `FRAME_STYLES`), `e2e/play-screen.qa.spec.ts` (`stubEmulatorReady`, `routeBezel`, `mockGame`), `tests/emulator-cores.test.ts` (node:test style), SF04 `plan.md` Frontend (format)

---

## QA/E2E Specification

Scope: SF02 emulator-controls. Source: `subfeatures/SF02-emulator-controls/design.md` (5 screens, Design Contract), `about.md` RF01-RF06/RN01-RN04 + Success Metrics, this plan's Frontend and Test Specification sections (T21-T50). Harness for every row: dev server with `MONGODB_DB=retrokey_e2e`; data only via `page.route` (`mockGame(page, system)` on `**/api/game/**` for the 12 console ids, `/api/rom/**`, `/emulator.html`, EmulatorJS CDN); running state via `stubEmulatorRecorder(page)` (or `routeFakeEjsLoader(page)` for T25/T26/T28-T30); every Wide test (1024x768, 1366x768) calls `routeBezel(page, 'missing')`. Touch = `hasTouch` + `isMobile`. IDs continue the feature-wide sequence after SF04 QA02-QA05; E2E titles carry the `SF02-` prefix.

| ID | surface | SF | reachability | viewports | capture states | UX acceptance | functional scenario | a11y |
|----|---------|----|--------------|-----------|----------------|---------------|---------------------|------|
| QA06 | play-wide-legend | SF02 | route `/play/super-retro`, `auth: false`, Wide (`min-width:1024px` + `pointer:fine`); `data-slot="legend"` row after `StatusStrip`; console set per test by `mockGame` (12 ids) | 1024x768, 1366x768 fine (design override) | empty (loading-metadata, not-found, metadata-error, failed: row reserved, no chips), default (booting: chips, Edit keys `aria-disabled`), success (running), updated (after remap in QA07) | row `h-10` in flow, window box unchanged; one chip per button, direction sets (D-pad, Stick, 4 C) one chip; format `label [keycap]`, Select/Start separate; chips `text-xs` `--t-text`, keycap 1px `--t-muted`; Edit keys right, `shrink-0`, 40px high × ≥44px wide; Legend fit: `scrollWidth ≤ clientWidth`, no chip clipped for 12 consoles (PS 11, N64 9 worst cases); 0 primary CTA | not a data-entity surface (Read side of the keys map). G nes running T chips `D-pad [↑ ↓ ← →]`, `B [Z]`, `A [X]`, `Select [Space]`, `Start [Enter]`, per-console labels for 12 ids (T21). G booting T Edit keys `aria-disabled` (T21). G 1024/1366 × 12 consoles T fit (T22). G touch 390x844/844x390/1366x768 T row hidden, no Edit keys (T23). G each `EMULATOR_CANVAS_READY` + Reload T one `RK_CONTROLS` object per ready (T24). | axe 0 violations in running (T46); chip text ≥4.5:1 on `--t-bg` in 12 themes; visible focus `--t-accent` on Edit keys; Edit keys accessible name |
| QA07 | keys-panel | SF02 | modal: `/play/super-retro` Wide running → click Edit keys (legend) → native `<dialog>` `showModal()` | 1366x768 fine (T32-T39); 1024x768 fine (design override, see gap) | default (idle), filled (capture), error (rejected, no-storage), created (saved, first remap), updated (swapped, remap again), deleted (reset) | centered `max-w-md`, `max-h-[80vh]`, fixed header/footer, list scrolls; surface `--t-bg`, 1px `--t-frame`, `--t-radius`, `p-6`, backdrop `bg-black/60`; title `text-lg` semibold + console name; `KeyRow` `min-h-11` `text-sm`, row in capture `--t-accent`; footer Reset (outline pill, disabled with no saved map) + Done (`ACTION_CLASS`, only primary); status copy exactly as design.md panel state table; window box 0px delta while open (T38) | **Create (remap):** row A → "Press a key for A. Esc cancels." → `KeyV` → "Saved.", legend `A [V]`, new `RK_CONTROLS` binds `KeyV`→8, `localStorage['retrokey:controls:v1:nes']` = new map (T32). **Read:** panel lists 5 rows for nes with current keys (T32); bad saved value / other console's save ignored, default shown (T36). **Update (remap again / swap):** `Tab`, `F1`, `ShiftLeft` → "That key can't be used. Pick another.", capture continues; `Escape` in capture → idle, map unchanged, dialog open; `KeyZ` on A → "Z was on B; swapped." (T33); remap survives `page.reload()`, Reset enabled (T34). **Delete (reset):** Reset → "Default keys restored.", legend `A [X]`, Reset disabled, storage key absent, default `RK_CONTROLS` (T35). **List:** n/a (one map per console). **no-storage:** `setItem` throws → "Keys can't be saved in this browser.", map valid for the session, default after reload (T37). **Close:** Done with Enter / Escape in idle → `activeElement` = iframe, no `Enter` keydown in recorder (T38). | axe 0 violations in idle and capture (T39); `<dialog>` `aria-labelledby`; status `role="status"`; focus held in dialog, returned to iframe (fallback Edit keys); rows and footer buttons ≥44px; visible focus `--t-accent` |
| QA08 | virtual-controller | SF02 | route `/play/super-retro`, touch (`pointer:coarse`), `data-slot="touch-overlay"`; appears on its own in booting/running; 12 consoles via `mockGame`; portrait and landscape are the same surface on two viewports | 390x844, 844x390 touch (design override) | empty (loading-metadata, not-found, metadata-error, failed: hidden), default (booting, inert), success (running), submitted (pressed button), updated (N64 D-pad/Stick toggled) | overlay `pointer-events-none`, buttons only; clusters 132px, cells 44px, D-pad 0px gap, other buttons 8px gap; shoulder row 44px (PS L1/L2, R1/R2 96px), center column 44px + 8px; N64 3×3 right grid, Z centered in shoulder row, toggle above Start; bottom reserve `h-8` + safe-area; portrait: bottom band, 0 button over `[data-window]` or the strip (budget 184/132px); landscape: side bands, overlap ≤24px with 0.8 bg + 2px `--t-accent`, Select/Coin under left, Start under right; rest 0.6 `--t-bg` + 2px `--t-accent`, pressed `--t-accent` + `#18181B`, no transition; window box 0px delta across states (T42) | not a data-entity surface — no CRUD. G 12 consoles × 2 viewports running T visible, `[data-button]` count = `BUTTONS_BY_CONSOLE[id]` length (N64 per toggle), `aria-label` = `buttonLabel`, each ≥44x44 (T40). G same matrix T Controller fit (T41). G booting T `aria-disabled`, 0 `RK_INPUT`; running pointerdown/up on `a` T `RK_INPUT {index, pressed:true}` then `false`; pointercancel on `up` T `pressed:false` (T43). | axe 0 violations in running (T46, `target-size`, `color-contrast`); each button named by console button; contrast UI ≥3:1 for `--t-accent` outline on `--t-bg` in 12 themes; `transition-duration` 0s (T46) |
| QA09 | rotate-hint | SF02 | overlay: `/play/super-retro` touch portrait; appears on its own in the top band (rendered by `VirtualController`); dismissed flag in `sessionStorage` | 390x844 touch (shown), 844x390 touch (absent) | default (visible, booting/running), success (dismissed, and absent in landscape) | pill `min-h-11`, `text-sm` `--t-text` on `--t-bg`, 1px `--t-accent`, centered in top band; text "Turn your phone sideways for a bigger game."; Dismiss 44x44, secondary (0 primary CTA); never moves the window (T42) | not a data-entity surface — no CRUD. G 390x844 T text visible; G 844x390 T absent; G Dismiss T hidden, stays hidden after reload in same session (T44). | Dismiss accessible name + ≥44x44; text ≥4.5:1; non-blocking (no focus trap, no `role="alert"`) |
| QA10 | fullscreen-toggle | SF02 | overlay: `/play/super-retro` top bar, `data-slot="fullscreen"` (44x44), every viewport with `document.fullscreenEnabled` | 390x844 touch, 1366x768 fine (T45); 844x390 touch, 1024x768 fine (design: every viewport, see gap) | default (off), success (on) | icon button in the existing 44x44 slot, no top-bar layout change; label "Full screen" / "Exit full screen"; target = `play-stage`; 0 primary CTA | not a data-entity surface — no CRUD. G click T `aria-pressed` `false`→`true`, `document.fullscreenElement` = play-stage; click again T `false` (T45). | `aria-pressed` synced on `fullscreenchange`; accessible name changes with state; ≥44x44; visible focus |

State mapping: canonical vocabulary is one file per `<screen>.<state>.<viewport>.png`, so `empty`, `default`, `error`, `success` cover several design states; each capture records its design-state name (`booting`, `capture`, `rejected`, `no-storage`, `pressed`, `n64-stick`/`n64-dpad`, `dismissed`) in `test.info().annotations` and the test title, as in SF04. Keys-panel CRUD mapping (local data, `localStorage` per console): created = saved, updated = swapped/remap again, deleted = reset, error = rejected + no-storage. `qa.viewports` defaults (1440x900, 768x1024, 375x812) are replaced on every row by the design override.

Coverage notes / gaps (none invented, flagged for owner or @e2e-agent):
- G1 (now T49): no test ID captures the legend `empty` state (loading-metadata/not-found/failed row reserved, empty) nor the controller hidden state in those states; T21/T40 start at booting.
- G2: the Keys panel has no test at 1024x768 (T32-T39 use 1366x768); design Legend fit covers 1024 only for the legend (T22).
- G3 (now T50): Breakpoint behaviour "below Wide with mouse: no legend, no controller" (e.g. 768x1024 fine) has no SF02 test ID; T23 covers touch only.
- G4: fullscreen `unsupported` (hidden) and `refused → stays off` states have no test; Chromium headless supports the API. 844x390 and 1024x768 not in T45. `orientation.lock` not testable headless.
- G5: pressed visual (`--t-accent` bg, `#18181B` label) has no assertion beyond `transition-duration` (T46); captured as `submitted` for @qa-agent judgment.
- G6: Gamepad metric (`navigator.getGamepads` mock) replaced by T04 + T26 + manual T27 (OQ-1 accepted); no screen surface.
- G7: Spacing/Token allowlist/Typographic scale (panel title `text-lg`, touch labels `text-sm`) are judged by @qa-agent from computed styles; only chip 12px (T21) is asserted in a test.
- G8: no catalog `kind` names an inline control exactly; `rotate-hint` and `fullscreen-toggle` use `kind: "overlay"` with a `goto` open recipe (same choice as SF04 QA05). Selectors in `screens.json` are intent only; @e2e-agent finalizes them.


---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Tasks |
|----|-------------|----------|--------------|-------|
| RF01 | Mapa de teclado padrão para os 12 sistemas | YES | Lib + Emulator + E2E | 1, 2, 3, 4, 9 |
| RF02 | Legenda das teclas em ponteiro fino (Wide); sem legenda no toque | YES | Frontend + E2E | 6, 8, 9, 10 |
| RF03 | Gamepad funciona com o mapa padrão, sem configuração | YES | Lib + Emulator + E2E + manual | 1, 3, 4, 9, 11 |
| RF04 | Remapeamento no navegador, salvo no aparelho, com volta ao padrão | YES | Frontend + E2E | 5, 6, 8, 9 |
| RF05 | Controle virtual nos 12 sistemas, tela cheia e sugestão de girar no celular | YES | Frontend + E2E | 7, 8, 10 |
| RF06 | Módulo exporta mapas padrão e validação para a SF03 | YES | Lib + test | 2, 3, 4 |
| RN01 | Master System e Game Gear com esquema de 2 botões próprio | YES | Lib + Emulator + E2E + spike | 1, 2, 3, 4, 9 |
| RN02 | Mapa de listas fechadas, validado, por `postMessage`, nunca texto livre | YES | Lib + Emulator + E2E | 2, 3, 4, 5, 9 |
| RN03 | Origem e janela conferidas nos dois sentidos | YES | Lib + Emulator + Frontend + E2E | 2, 3, 4, 5, 9 |
| RN04 | Painel por console no `localStorage`; jogador vence o resolvido; reset volta ao resolvido | YES | Lib + Frontend + E2E | 2, 3, 5, 6, 9 |
| Scope: correção do esquema de Master System e Game Gear | — | YES | Emulator | 4 |
| Scope: checagem de origem e janela página ↔ emulador | — | YES | Emulator + Frontend | 4, 5 |
| Scope: encaixe nos espaços da SF01/SF04 sem mudar proporções | — | YES | Frontend + E2E | 8, 10 (T42, Layout stability) |
| Scope: inclusão do teste no gate | — | YES | Chore | 12 |
| Edição dos mapas pelo admin | — | EXCLUDED | — | SF03 (about.md Does NOT Include) |
| Visual e tema | — | EXCLUDED | — | SF01 (about.md Does NOT Include) |
| Remapear o gamepad | — | EXCLUDED | — | RF04 cobre só teclado; gamepad nativo do EmulatorJS |
| Legenda e painel abaixo de 1024px com mouse | — | EXCLUDED | — | SF04 design.md D10, mantido pelo dono (design.md C2) |
| Pausar o jogo com o painel aberto | — | EXCLUDED | — | não verificado no EmulatorJS; design.md Flows |
| QA-01, QA-02, QA-03, QA-05, QA-06, QA-07 (review-001) | — | EXCLUDED | — | abertos só para `Wide` sem bezel; fora do escopo da SF02 |

Coverage: 10/10 requisitos e 4/4 itens de escopo (100%). As 8 métricas de sucesso do about.md estão mapeadas em Test Specification → Coverage vs Requirements. A métrica do gamepad usa a troca aceita pelo dono (OQ-1).

## Overview
Hoje só 6 dos 12 consoles têm mapa de controle. Master System e Game Gear usam o esquema do Mega Drive. A legenda não existe, e no celular não há controle garantido.

A SF02 resolve isso com uma fonte única de verdade, o módulo puro `lib/emulator-controls.ts`. O `emulator.html` espelha esse módulo num bloco JSON conferido por teste. A página manda o mapa e os toques por `postMessage` com origem conferida, e o iframe aplica tudo com `simulateInput` do EmulatorJS.

Na tela, os controles ocupam só os slots que a SF04 deixou: legenda e painel em `Wide`, controle virtual e sugestão de girar no toque, e tela cheia na barra de topo. A janela do jogo não muda de tamanho.

## Main Flow
1. Jogador → abre `/play/{slug}` → metadados 200 → `PlayStage` resolve o console por `consoleIdForSystem(system)` → `useControlMap` lê o `localStorage` → mapa resolvido (jogador > padrão).
2. `Emulator` → monta o iframe `/emulator.html?title&core&rom&console` → `emulator.html` define `EJS_controlScheme` e os `value2` do gamepad antes do `loader.js`.
3. `emulator.html` → `EMULATOR_CANVAS_READY` (destino `location.origin`) → `Emulator` confere origem e janela → envia `RK_CONTROLS` → o iframe confere de novo e guarda o mapa.
4. Jogador no PC → tecla → listener do iframe → `simulateInput(0, índice, 1/0)`; a legenda mostra as teclas.
5. Jogador → Edit keys → painel Keys → captura → `applyRemap` → `localStorage` → novo `RK_CONTROLS` → legenda atualiza. Reset → apaga a chave → mapa padrão.
6. Jogador no celular → toque num botão do `VirtualController` → `buttonIndex` → `EmulatorHandle.sendInput` → `RK_INPUT` → `simulateInput`.
7. Jogador → tela cheia → `requestFullscreen` no `play-stage` → tenta travar em paisagem.

## Implementation Order
Spike (manual) → `tests/emulator-controls.test.ts` → `lib/emulator-controls.ts` → `public/emulator.html` → `Emulator` + `useControlMap` → `ControlsLegend` + `KeysPanel` → `VirtualController` + `RotateHint` + `FullscreenToggle` → `PlayStage` → E2E de legenda, mapa e painel → E2E de toque → teste manual do controle físico → gate do AGENTS.md. Sem etapa de banco nem de backend.

## Quick Reference

| pattern | search terms |
|---|---|
| Módulo puro de domínio | `lib/play-theme.ts`, `lib/bezel-console.ts` |
| Ids dos 12 consoles | `BEZEL_CONSOLE_IDS`, `isBezelConsoleId` |
| Palco, slots e modos | `components/PlayStage.tsx`, `data-slot=` |
| Barra de topo e slot de tela cheia | `components/PlayTopBar.tsx`, `data-slot="fullscreen"` |
| iframe e mensagem de pronto | `components/Emulator.tsx`, `EMULATOR_CANVAS_READY` |
| Globais do EmulatorJS | `public/emulator.html`, `EJS_defaultControls`, `EJS_controlScheme` |
| Teste unitário node:test | `tests/emulator-cores.test.ts`, `tests/play-theme.test.ts` |
| E2E com stub do emulador | `e2e/play-screen.qa.spec.ts`, `stubEmulatorReady`, `routeBezel`, `mockGame` |
