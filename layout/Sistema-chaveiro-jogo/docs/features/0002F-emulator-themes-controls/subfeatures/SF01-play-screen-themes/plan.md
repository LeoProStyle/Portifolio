---
id: 0002F-SF01
type: feature-plan
created: 2026-11-06
updated: 2026-11-06
related: [0002F]
tags: [emulator, ui, mobile, themes]
---

# Plan: 0002F-emulator-themes-controls — SF01 play-screen-themes

> **Delivery:** confirm

## TL;DR
Plano da SF01 do {{doc:0002F}}. A tela de jogo hoje é um cartão com iframe fixo de 600px. Ela passa a ser um palco de tela inteira, sem rolagem, com a moldura do console desenhada pela página em volta do emulador. Os 13 temas (12 consoles + `neutral`) ficam validados no código, em `lib/play-theme.ts`, sem banco. A entrega tem 4 componentes novos, mudanças pequenas em `components/Emulator.tsx` e `lib/emulator-cores.ts`, 2 testes unitários e 1 spec E2E. Só frontend: nada de banco, login ou rotas de API.

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

Quando este plano estiver construído, `/play/[slug]` cabe sem rolagem em 390×844, 844×390 e 1366×768 e mostra a moldura e as cores do console do jogo, também com o MongoDB fora do ar.

## Context
O about da SF01 ({{doc:0002F-SF01}}) pede tema por console (RF01), tela responsiva (RF02), moldura e fundo na página (RF03) e valores validados (RN01-RN03). Este plano fixa os contratos de código: os exports de `lib/play-theme.ts`, o callback de status do `Emulator`, os seis estados da página e os três espaços que a SF02 ocupa. Layout, estados e tokens estão em `subfeatures/SF01-play-screen-themes/design.md` e não são repetidos aqui.

## Global Constraints
- `{"build":"npm run build","test":"node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts"}` (AGENTS.md validation_gates)
- Typecheck runs inside `next build`. No lint or format gate exists. (AGENTS.md)
- `app/**` (pages + API route handlers) → `components/**` → `lib/*` → `models/*`. Imports point inward only; inner never imports outer. No circular imports. (AGENTS.md Layers)
- Import modules by path through the `@/` alias; there are no barrel files. (AGENTS.md Import Rules)
- `{"framework":{"name":"Next.js","version":"14.2.15","router":"App Router"}}`, `{"frontend":{"ui":"React 18.2","styling":"Tailwind 3.4"}}`, `"node":"24.x"` (AGENTS.md Stack)
- Tailwind's `content` only scans `app/**` and `components/**`, so classes placed anywhere else are purged. (.codeadd/wiki/domains/frontend.md Styling)
- O tema de um jogo vem do padrão do console no código quando não há outro valor; funciona com MongoDB fora do ar. (about.md SF01 RN01)
- Nada em lib/mongo.ts, lib/admin-login.ts, lib/login-throttle.ts, lib/auth-guard.ts, auth.ts, auth.config.ts, middleware.ts, app/api/auth/**, app/api/admin/**. (dono, restrição da rodada)
- /api/rom/[slug] continua pública, sem login. (dono, restrição da rodada)
- Rodar E2E um projeto por vez (--project=main, depois --project=no-mongo), apagando .next antes, com as portas 3001/3002 livres; E2E usa retrokey_e2e. (dono, restrição da rodada)
- Nunca imprimir nem commitar valores de .env, .env.local ou cookies.txt (só nomes de variáveis). (dono, restrição da rodada)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Tema aplicado por custom properties (`--t-*`) em `style` inline + `data-frame` com regras em `app/globals.css` | Valores de tema são dados em runtime; o Tailwind não gera classe que não encontra no código | Classes Tailwind montadas por string — removidas no build | Tailwind content scan (wiki frontend.md) |
| Moldura e fundo desenhados no React em volta do iframe; nenhum valor de tema na URL do iframe | O iframe roda na mesma origem, sem sandbox; texto de tema dentro dele seria vetor de XSS | `EJS_color` / `EJS_backgroundImage` dentro do `emulator.html` | about.md do epic, Decisions |
| `resolveEmulatorSystem` extraída de `getCoreForSystem` em `lib/emulator-cores.ts` | GB e GBC usam o mesmo core `gambatte`; o tema precisa do sistema, não do core; uma só tabela de aliases | Escolher tema pelo core — GB e GBC ficariam iguais; segunda tabela de aliases em `lib/play-theme.ts` — duas fontes divergem | RF01 (12 temas distintos) |
| Página continua cliente buscando `/api/game/{slug}`; o skeleton não tem proporção | `/api/game` segue a única leitura; não muda o caminho de dados de uma página em produção | Server component com `initialGame` (crítica de UX, item 2) | Sistema em produção |
| `PlayTheme.bgImage` opcional, só validado | SF03 reaproveita o formato e o validador; SF01 não renderiza imagem | Deixar a SF03 definir — dois donos da lista de hosts | about.md SF01 Decisions (lista de domínios: dona SF01) |
| Reload remonta o `Emulator` por `key`; Retry refaz só a busca de metadados | Recomeça a cadeia de cores sem recarregar a página | `window.location.reload()` — refaz tudo e perde o estado da página | design.md Design Review item 8 |
| T06 do test-spec ajustado: `touch-overlay` cobre o palco abaixo da barra | Consistência com design.md (crítica item 5, aceito) | Overlay só no quadro — cobre a imagem no retrato | design.md Screens |

## Tasks
1. - [ ] frontend: `lib/play-theme.ts` com 13 temas, validação RN02 e contraste — `tests/play-theme.test.ts` verde (T01-T03, T09-T16) — M
2. - [ ] frontend: antes de editar, rodar GitNexus `impact` upstream em `getCoreForSystem` e registrar callers e risco (índice sem símbolos → registrar NOT VERIFIED e o resultado da busca de texto); depois `resolveEmulatorSystem` em `lib/emulator-cores.ts` e `getCoreForSystem` delega — `tests/emulator-cores.test.ts` verde (T04) — S
3. - [ ] frontend: antes de editar, `impact` upstream em `Emulator` (mesma regra de NOT VERIFIED); depois `components/Emulator.tsx` com `onStatusChange`, sem barra própria e sem 600px — `npm run build` verde; no diff, `getCoreCandidates`, `FALLBACK_TIMEOUT_MS`, `RETRY_DELAY_MS` e a ordem de tentativas sem mudança; `failed` emitido só nos três ramos de cores esgotados, confirmado pelo E2E T08 — S
4. - [ ] frontend: `PlayStage`, `PlayTopBar`, `ThemedFrame`, `StatusStrip` e regras `[data-frame]` em `app/globals.css` — `npm run build` verde — M
5. - [ ] frontend: `app/play/[slug]/page.tsx` com `metaState` e Retry — `npm run build` verde — S
6. - [ ] test: `e2e/play-screen.qa.spec.ts` nos projetos `main` e `no-mongo` — T05-T08, T17 verdes — M
   - `super-retro` vem de `mockGames` nos dois projetos: `getGames` junta mock + Mongo (`lib/data.ts:28`), e no `main` o banco `retrokey_e2e` não tem esse slug; sem seed. Se um registro `super-retro` existir no `retrokey_e2e`, ele vence o mock e o teste deve usar outro slug mock.
   - Estado `running`: capturado com `page.route('**/emulator.html*')` servindo uma página stub que envia `{type:'EMULATOR_CANVAS_READY'}` ao `parent`. Os demais estados usam o `emulator.html` real.
   - Estado `failed`: cadeia real de cores (fbneo tem 3 candidatos, cerca de 31s); esses testes usam `test.setTimeout(90_000)`.
   - Cada captura registra o nome do estado do design (`loading-metadata`, `not-found`, `metadata-error`, `booting`, `running`, `failed`) em `test.info().annotations` e no título do teste.
7. - [ ] chore: os dois testes novos entram no `test` gate do AGENTS.md — o comando roda os 5 arquivos — S

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| `resolveEmulatorSystem` muda o core de um nome legado | baixa | jogo abre no core errado em produção | T04 trava o mapa atual antes da extração; impacto por busca de texto (NOT VERIFIED pelo GitNexus): 1 caller, `app/play/[slug]/page.tsx:54` |
| `failed` emitido num timeout intermediário | média | painel de falha aparece entre tentativas | emitir `failed` só nos três ramos de cores esgotados; E2E T08 |
| Estado `running` sem ROM no E2E (`public/roms` não existe) | alta | captura `success` fica sem evidência | stub de `/emulator.html` via `page.route` que envia `EMULATOR_CANVAS_READY` (Task 6) |
| Teste de `failed` passa do timeout padrão do Playwright (60s no config) | média | T08 falha de forma intermitente | `test.setTimeout(90_000)` nos testes de `failed` (Task 6) |
| Proporção 4/3 aproximada em Arcade e Neo Geo | média | barras pretas dentro do quadro | o EmulatorJS ajusta o canvas dentro do iframe; revisar no QA visual |
| `dvh` sem suporte em navegador antigo | baixa | rolagem leve em mobile antigo | declarar `100vh` antes de `100dvh` |
| ui-ux-pro-max não rodou (`python3`/`python` são só o alias da Windows Store) | certa | design sem a fonte de estilo extra | design.md usa os tokens do projeto e o `add--ux-design` |

## Validation
- `npm run build` sai com 0 (typecheck incluso).
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts` sai com 0.
- Com `.next` apagado e as portas 3001/3002 livres: `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; apagar `.next` de novo; `--project=no-mongo`. Os dois verdes.
- QA visual (`/add-review`) contra o `## Design Contract` do design.md nas três viewports.
- Antes de cada commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .` (AGENTS.md); resultado `partial`/`truncated` ou índice sem símbolos é registrado como NOT VERIFIED, junto com a lista de arquivos do `git diff --name-only`.

---

## Test Specification

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Each of 12 systems has a valid default theme | frontend | RF01 | `DEFAULT_PLAY_THEMES[s]` for the 12 `EmulatorSystem` keys | `PlayTheme` with hex `bg`/`accent`/`frameColor`, `frame` in `FRAME_STYLES`, `ar` in `ASPECT_RATIOS` | 12/12 keys present; `validatePlayTheme(t, t)` deep-equals `t` |
| T02 | Default themes meet 4.5:1 contrast | frontend | RF01 | 12 defaults + `NEUTRAL_PLAY_THEME` | `contrastRatio(text, bg)` and `contrastRatio(accent, bg)` | both >= 4.5 for all 13 |
| T03 | Known system resolves to its console theme | frontend | RF01/RN01 | `resolvePlayTheme('SNES')`, `resolvePlayTheme('Mega Drive / Genesis')` | `DEFAULT_PLAY_THEMES['SNES']`, `DEFAULT_PLAY_THEMES['Mega Drive / Genesis']` | deep-equal; no DB import in module |
| T04 | Legacy aliases keep the same core | frontend | RN01 | every exact name + legacy alias to `resolveEmulatorSystem` / `getCoreForSystem` | same `EmulatorSystem` and core string as before the refactor | table-driven equality |
| T05 | Play screen fits viewport without scroll | frontend | RF02 | `/play/super-retro` at 390x844, 844x390, 1366x768 | frame visible, aspect kept | `scrollHeight <= innerHeight`; frame box ratio = `--t-ar` (±2%) |
| T06 | SF02 slots present, legend only on fine pointer | frontend | RF02 | same 3 viewports, pointer fine vs coarse | `data-slot="legend"` visible only on fine; `touch-overlay` covers the stage below the top bar, frame box unchanged | visibility + no scroll with slots |
| T07 | Background and frame drawn on page around iframe | frontend | RF03 | `/play/super-retro` | root has `--t-bg`; element `[data-frame="arcade"]` wraps the emulator iframe | computed `background-color` = theme `bg`; iframe is descendant of `[data-frame]`; iframe `src` has no theme value |
| T08 | Theme renders with MongoDB down | frontend | RN01 | `no-mongo` project, `/play/super-retro` | arcade theme applied, reaches `failed` + Reload | `[data-frame="arcade"]` present; Reload remounts boot |
| T09 | No override -> console default | frontend | RN01 | `resolvePlayTheme('NES', undefined)` | `DEFAULT_PLAY_THEMES['NES']` | deep-equal |
| T10 | Valid override accepted over default | frontend | RN02/RN01 | `validatePlayTheme({bg:'#101820',frame:'gba',bgImage:'https://upload.wikimedia.org/a.png'}, fb)` with `fb = DEFAULT_PLAY_THEMES['NES']` (its accent `#FF4D4D` is 5.47:1 on `#101820`, text 16.28:1); same via `resolvePlayTheme('NES', override)` | fields kept, not the NES default | output has the given values |
| T11 | Invalid hex/frame/ar fall back per field | frontend | RN02 | `bg:'red'`, `'#FFF'`, `'#GGGGGG'`, `frame:'xbox'`, `ar:'16/9'`, `radius:'7px'`, `radius:'calc(1px)'`, non-string | fallback value per invalid field | `isHexColor`/`isFrameStyle` false; field = fallback |
| T12 | Low-contrast override -> whole fallback | frontend | RN02 | override with accent ratio < 4.5 on bg | `fallback` | deep-equal fallback |
| T13 | Allowed image hosts accepted | frontend | RN02 | `https://i.imgur.com/x.png`, `https://raw.githubusercontent.com/a/b.png`, `https://I.IMGUR.COM/x.png` | `true` (uppercase normalized to lowercase) | `isAllowedImageUrl` true |
| T14 | Image host attacks refused | frontend | RN02 | `https://i.imgur.com.evil.com/x`, `https://x.i.imgur.com/x`, `http://i.imgur.com/x`, `https://i.imgur.com:443/x`, `https://i.imgur.com:8080/x`, `https://user:pass@i.imgur.com/x`, `javascript:`, `''`, `42` | `false`; in theme -> `bgImage` dropped/fallback | each case false |
| T15 | Unknown system -> neutral theme | frontend | RN03 | `resolvePlayTheme('Atari Jaguar')`, `(null)`, `('')` | `NEUTRAL_PLAY_THEME` | deep-equal; `frame='neutral'` |
| T16 | Known system does not get neutral | frontend | RN03 | `resolvePlayTheme('Game Boy')` | `frame='dmg'` | not equal to neutral |
| T17 | Unknown slug / metadata error use neutral | frontend | RN03 | `/play/nope` (404); `/api/game/**` aborted | not-found panel; metadata-error + Retry; `data-frame="neutral"` | role=alert on error; Retry refetches |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| frontend (unit, node:test) | `tests/play-theme.test.ts` | T01, T02, T03, T09, T10, T11, T12, T13, T14, T15, T16 |
| frontend (unit, node:test) | `tests/emulator-cores.test.ts` | T04 |
| frontend (E2E, projects `main` + `no-mongo`) | `e2e/play-screen.qa.spec.ts` | T05, T06, T07, T08, T17 |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|----------|
| RF01 | T01, T02, T03 | ✅ |
| RF02 | T05, T06 | ✅ |
| RF03 | T07 | ✅ |
| RN01 | +T03, T04, T08, T09 / -T10 (valid override present, default not used) | ✅ |
| RN02 | +T10, T13 / -T11, T12, T14 | ✅ |
| RN03 | +T15, T17 / -T16 | ✅ |

Coverage: 6/6 (100%).

---

## Frontend

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| `/play/[slug]` | `app/play/[slug]/page.tsx` (client, rewritten) | Owns `metaState: 'loading'\|'not-found'\|'metadata-error'\|'ok'` from `fetch('/api/game/{slug}')` (200→ok, 404→not-found, network/other→metadata-error); `retryCount` in effect deps drives Retry; ignore-flag on unmount; drops the `max-w-5xl` card and renders only `<PlayStage slug game metaState onRetry>` (layout/states: `design.md` Screens + state table) |

### Components
{"PlayStage":{"location":"components/","purpose":"100dvh root; resolves theme, sets --t-* vars + data-frame, owns bootKey/emulator status"},"PlayTopBar":{"location":"components/","purpose":"Back home link, h1 title, system label, fullscreen-slot cell"},"ThemedFrame":{"location":"components/","purpose":"Skeleton, framed Emulator, or state-panel with Retry/Reload CTA"},"StatusStrip":{"location":"components/","purpose":"Short status label per state, role=status, sr-only core"},"Emulator":{"location":"components/ (existing)","purpose":"Add onStatusChange; drop own status bar and 600px height"}}

- Props/states exactly as `design.md` Components; slots (`fullscreen-slot` in PlayTopBar, `touch-overlay-slot` + `legend-slot` in PlayStage) render empty elements with `data-slot="fullscreen|touch-overlay|legend"` as the stable SF02 mount points; visibility by `(pointer: fine|coarse)` via Tailwind arbitrary variants `[@media(pointer:coarse)]:` (`design.md` Screens "Espaços reservados").
- Emulator.tsx: new optional prop `onStatusChange?: (state: 'booting'|'running'|'failed', attempt: number, total: number, core: string) => void`, held in a ref so the `useEffect([gameSlug, gameTitle, core])` deps do not change; emit `booting` in `tryCore`, `running` on `EMULATOR_CANVAS_READY`, `failed` only on the three exhausted branches (not on intermediate per-core timeouts). Remove the status `<div>` (`:196-198`), root becomes `h-full w-full`, iframe `w-full h-full` (keeps `title`, `allow`); `getCoreCandidates`, timeouts and fallback chain untouched. Reload = PlayStage increments `bootKey` used as `<Emulator key>`.
- `app/globals.css`: `@layer components` base rule `[data-frame]` (border 1px `--t-accent`, radius from theme var `--t-radius`, padding `clamp(8px, 1.5vmin, 20px)`, background `--t-frame`, `aspect-ratio: var(--t-ar)`) plus one `[data-frame="<id>"]` rule per 13 ids (bezel detail only via gradients/box-shadow on `--t-frame`/`--t-accent`, no text); `@media (prefers-reduced-motion: reduce)` disables frame transitions (`design.md` Tokens + Design Contract Motion/Radius).

### lib/play-theme.ts exports (pure, no React, no DB; SF03 consumes)
| Export | Signature |
|---|---|
| `FRAME_STYLES` / `FrameStyle` | `readonly ['nes','snes','n64','dmg','gbc','gba','sms','megadrive','gamegear','ps','arcade','neogeo','neutral']` / union of it |
| `ASPECT_RATIOS` / `AspectRatio` | `readonly ['4/3','10/9','3/2']` / union |
| `PlayTheme` | `{ frame: FrameStyle; bg: string; accent: string; frameColor: string; ar: AspectRatio; radius: string; bgImage?: string }` (`bgImage` validated only, no SF01 default sets it) |
| `DEFAULT_PLAY_THEMES`, `NEUTRAL_PLAY_THEME` | `Record<EmulatorSystem, PlayTheme>`, `PlayTheme` — values from `design.md` Tokens JSON; keys are the `EmulatorSystem` display names from `lib/emulator-cores.ts:1-13` (`'NES'`, `'Mega Drive / Genesis'`, ...), never lowercase ids; any other spelling goes through `resolveEmulatorSystem` |
| `ALLOWED_IMAGE_HOSTS` | `readonly ['i.imgur.com','upload.wikimedia.org','raw.githubusercontent.com']` |
| `isHexColor`, `isFrameStyle`, `isAllowedImageUrl` | `(v: unknown) => boolean`; image: `new URL`, `https:`, empty username/password, no port in raw authority (incl. `:443`), lowercase hostname exact match (RN02) |
| `contrastRatio`, `pickTextColor` | `(a: string, b: string) => number` (WCAG); `(bg: string) => '#F4F4F5'\|'#18181B'` |
| `validatePlayTheme` | `(input: unknown, fallback: PlayTheme) => PlayTheme` — invalid field → fallback field; `radius` accepted only if one of `'12px'`, `'16px'`, `'24px'` (design.md Tokens), else fallback field; text or accent < 4.5:1 on bg → whole fallback |
| `resolvePlayTheme` | `(system?: string\|null, override?: unknown) => PlayTheme` — `resolveEmulatorSystem(system)` → default, else `NEUTRAL_PLAY_THEME` (RN01/RN03) |
| `playThemeCssVars` | `(t: PlayTheme) => Record<'--t-bg'\|'--t-accent'\|'--t-frame'\|'--t-text'\|'--t-muted'\|'--t-ar'\|'--t-radius', string>` for inline `style` only, never passed into the iframe URL |

- `lib/emulator-cores.ts`: add `resolveEmulatorSystem(system?: string|null): EmulatorSystem | null` holding the existing ordered exact + legacy-alias rules; `getCoreForSystem` delegates (`systemToCoreMap[resolved] ?? defaultEmulatorCore`, same log lines). Impact (text search, NOT VERIFIED by GitNexus): `getCoreForSystem` ← `app/play/[slug]/page.tsx:54` only; `systemOptions` ← `components/admin/GamesTab.tsx:180` (unchanged); `Emulator` ← `app/play/[slug]/page.tsx:3` only.

### Hooks & State
{"hooks":{"none new":"local useState/useEffect, matching current page; PlayStage holds emuStatus {state,attempt,total,core} + bootKey; page holds game, metaState, retryCount"},"stores":{"none":"no global store in project (Providers.tsx only wraps SessionProvider)"}}

### Types (mirror from backend)
{"PlayTheme":{"fields":"see table above","sourceDTO":"none — no backend DTO; defined in lib/play-theme.ts"},"PlayGameMeta":{"fields":"title: string; system?: string; console?: string","sourceDTO":"GET /api/game/[id] JSON (unchanged), local to page.tsx as today"},"MetaState":{"fields":"'loading'|'not-found'|'metadata-error'|'ok'","sourceDTO":"none, UI state"}}

### Tests
- Unit `tests/play-theme.test.ts` (node:test, like `tests/rom-path.test.ts`): 12/12 defaults + neutral valid, contrast ≥ 4.5:1 on all 13, invalid hex/frame/ar → fallback, host attacks (`i.imgur.com.evil.com`, `x.i.imgur.com`, `:443`, userinfo, `http:`) rejected, unknown system → neutral. `tests/emulator-cores.test.ts`: every exact + legacy alias returns the same core as before. Add both to the AGENTS.md `test` gate.
- E2E `e2e/play-screen.qa.spec.ts` on `main` and `no-mongo` projects: mock slug `super-retro` (arcade theme, ROM missing → reaches failed + Reload), unknown slug → not-found, `page.route('/api/game/**', abort)` → metadata-error + Retry; viewports 390×844, 844×390, 1366×768 assert `scrollHeight ≤ innerHeight` and `data-slot` presence/visibility per pointer.

Reference: `app/play/[slug]/page.tsx`, `components/Emulator.tsx`, `lib/emulator-cores.ts`, `components/RoomsSection.tsx` (flat client component), `tests/rom-path.test.ts`, `e2e/rom-path.qa.spec.ts`, `playwright.config.ts` (main/no-mongo projects)

---

## QA/E2E Specification

| ID | surface | SF | reachability | viewports | capture states | UX acceptance | functional scenario | a11y |
|----|---------|----|--------------|-----------|----------------|---------------|---------------------|------|
| QA01 | play | SF01 | route `/play/[slug]`, example `/play/super-retro` (mock, `Arcade (FBNeo)` → `data-frame="arcade"`), `auth: false`; not-found via unknown slug; metadata-error via aborted `/api/game/**` | 390x844, 844x390, 1366x768 (design override; replace `qa.viewports` defaults 1440x900/768x1024/375x812) | default (loading-metadata, booting), error (not-found, metadata-error, failed), success (running) | design.md state table: one primary CTA per state; state-panel centered in frame on `--t-bg`; skeleton without frame/aspect; framed `[data-frame]` with `--t-ar` aspect and 12/24/16px radius; no page scroll (`scrollHeight ≤ innerHeight`); legend-slot only on `pointer: fine`, touch-overlay-slot does not resize frame; frame box unchanged booting→running/failed; hierarchy frame > top bar > status strip; reduced-motion disables pulse | not a data-entity surface — no CRUD. G: `/play/super-retro` W: load T: theme vars + arcade frame wrap iframe, reaches failed (no ROM) and Reload remounts boot without page reload. G: unknown slug T: neutral frame + "Game not found" + Back home, no boot. G: `/api/game` aborted T: metadata-error + Retry refetches. G: `no-mongo` project T: same theme renders | 44px targets + 8px gap (Back home, Retry, Reload, fullscreen-slot; axe `target-size`); axe `color-contrast` ≥ 4.5:1; StatusStrip `role="status"`, failed/metadata-error panel `role="alert"`; Back home first in focus order, then iframe; iframe keeps `title="Play {gameTitle}"` |

State mapping: canonical vocabulary has one file per `<screen>.<state>.<viewport>.png`, so default/error each cover several design states. Resolved in Task 6: each capture records its design-state name in `test.info().annotations` and in the test title; `running` (success) is captured with the `page.route` stub of `/emulator.html` (the mock ROM `super-retro.bin` is absent); `booting` is captured before the core timeout.

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Tasks |
|----|-------------|----------|--------------|-------|
| RF01 | Tema padrão para cada um dos 12 sistemas | YES | Frontend (lib) | 1, 2 |
| RF02 | Tela se ajusta, mantém proporção, sem rolagem nas 3 viewports, com espaços da SF02 | YES | Frontend | 3, 4, 5, 6 |
| RF03 | Fundo e moldura desenhados na página | YES | Frontend | 4, 6 |
| RN01 | Padrão do console no código; funciona sem MongoDB | YES | Frontend (lib) + E2E no-mongo | 1, 2, 6 |
| RN02 | Só valores validados (hex, moldura, link https de host exato) | YES | Frontend (lib) | 1 |
| RN03 | Sistema desconhecido usa tema neutro | YES | Frontend (lib) + página | 1, 5, 6 |
| Scope: módulo de temas padrão e validação | — | YES | Frontend (lib) | 1 |
| Scope: página e componente responsivos com tema | — | YES | Frontend | 3, 4, 5 |
| Controles e controle virtual | — | EXCLUDED | — | SF02 (about.md SF01 Does NOT Include) |
| Edição de tema pelo admin e rota pública | — | EXCLUDED | — | SF03, adiada pelo dono (epic.md Notes) |

Coverage: 6/6 requisitos e 2/2 itens de escopo (100%).

## Overview
A tela de jogo hoje mostra o mesmo cartão escuro para todos os consoles, com um iframe fixo de 600px que não cabe no celular. A SF01 troca esse cartão por um palco de tela inteira. A moldura e as cores vêm do console do jogo e estão definidas e validadas no código.

O tema nunca entra no iframe. A página desenha fundo e moldura e reserva o espaço que a SF02 vai usar para a legenda, o controle virtual e a tela cheia. Assim a SF02 não muda as proporções.

## Main Flow
1. Jogador → abre `/play/{slug}` (link da home, sala, NFC ou URL).
2. Página → busca `/api/game/{slug}` e mostra o skeleton.
3. Página → 404 vira not-found; erro de rede vira metadata-error com Retry; 200 segue.
4. `PlayStage` → `resolvePlayTheme(game.system ?? game.console)` → aplica `--t-*` e `data-frame`.
5. `ThemedFrame` → monta o `Emulator`; o `Emulator` reporta booting, running ou failed por `onStatusChange`.
6. `StatusStrip` → mostra o rótulo do estado; em failed o painel do quadro mostra Reload, que remonta o `Emulator`.

## Implementation Order
`lib/play-theme.ts` + `resolveEmulatorSystem` → `components/Emulator.tsx` → componentes novos + `app/globals.css` → `app/play/[slug]/page.tsx` → `e2e/play-screen.qa.spec.ts` → gate do AGENTS.md. Sem etapa de banco nem de backend.

## Quick Reference

| pattern | search terms |
|---|---|
| Página cliente com fetch em `useEffect` | `app/play/[slug]/page.tsx`, `useEffect(() =>` |
| Componente cliente plano | `components/RoomsSection.tsx`, `'use client'` |
| Tabela de sistemas e aliases | `lib/emulator-cores.ts`, `getCoreForSystem` |
| Teste unitário node:test | `tests/rom-path.test.ts`, `node:test` |
| E2E com projetos main/no-mongo | `e2e/rom-path.qa.spec.ts`, `playwright.config.ts` |
