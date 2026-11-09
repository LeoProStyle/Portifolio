---
id: 0002F-SF04
type: feature-plan
created: 2026-11-09
updated: 2026-11-09
related: [0002F]
tags: [emulator, ui, mobile, bezel, admin, storage]
---

# Plan: 0002F-emulator-themes-controls — SF04 console-bezels

> **Delivery:** confirm

## TL;DR
Plano da SF04 do {{doc:0002F}}. O admin ganha uma aba própria "Bezels" para enviar, ver e remover um bezel PNG por console. O arquivo fica no R2 em `bezels/<id>.png`, sem MongoDB. Duas rotas novas: `POST`/`DELETE /api/admin/bezels/[console]` (com `requireAdmin`) e `GET /api/bezel/[console]` (pública). A tela de jogo passa a ter três modos. Em `Wide` com bezel, a imagem fica atrás do jogo numa área 16:9. Em `Wide` sem bezel, fica a moldura CSS da SF01. No celular não há moldura e o jogo ocupa a maior área. A entrega também fecha QA-04, QA-08, QA-09, QA-10, QA-11, QA-12, QA-13, CR-1, CR-2 e CR-3 do review-001. São 11 tarefas: 4 de backend, 4 de frontend, 2 de E2E e 1 do gate.

## TOC
- [Objective](#objective)
- [Context](#context)
- [Global Constraints](#global-constraints)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Backend](#backend)
- [Frontend](#frontend)
- [QA/E2E Specification](#qae2e-specification)
- [Requirements Coverage](#requirements-coverage)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Objective
Jogar no RetroKey é agradável no PC e no celular: cada um dos 12 consoles abre com visual e controles prontos, e o admin ajusta tema e controles sem mexer em código. `[from conversation, no brainstorm]`

Quando este plano estiver construído, o admin envia pela aba Bezels um PNG por console. O bezel aparece atrás do jogo em `(min-width: 1024px) and (pointer: fine)`. No celular o jogo ocupa a tela sem moldura. Sem bezel, sem R2 ou sem MongoDB, o jogo abre do mesmo jeito.

## Context
O about da SF04 ({{doc:0002F-SF04}}) pede a aba de bezels (RF01), a chave no R2 (RF02), a leitura pública (RF03), o bezel em telas largas (RF04), o layout sem moldura no celular (RF05) e as regras RN01-RN06. Este plano fixa os contratos de código:
- os exports de `lib/bezel-console.ts`, `lib/bezel.ts` e `lib/bezel-routes.ts`;
- o único export novo de `lib/r2.ts`;
- o mapa de status das duas rotas;
- a máquina de estado do bezel no `PlayStage`;
- os três modos do `ThemedFrame`;
- as mudanças nos E2E da SF01.

Layout, estados, textos e tokens estão em `subfeatures/SF04-console-bezels/design.md` e não se repetem aqui. O plano parte do código entregue na SF01 (checkpoint `checkpoint/0002F-SF01-done`).

## Global Constraints
- `{"validation_gates":{"build":"npm run build","test":"node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts"}}` (AGENTS.md Validation Gates)
- Typecheck runs inside `next build`. No lint or format gate exists. (AGENTS.md)
- `app/**` (pages + API route handlers) → `components/**` → `lib/*` → `models/*`. Imports point inward only; inner never imports outer. No circular imports. (AGENTS.md Layers)
- Import modules by path through the `@/` alias; there are no barrel files. (AGENTS.md Import Rules)
- `{"framework":{"name":"Next.js","version":"14.2.15","router":"App Router"}}`, `{"frontend":{"ui":"React 18.2","styling":"Tailwind 3.4"}}`, `{"storage":{"roms":"Cloudflare R2 via @aws-sdk/client-s3","fallback":"public/roms"}}`, `"node":"24.x"` (AGENTS.md Stack)
- O servidor aceita só arquivo com assinatura PNG nos bytes (`89 50 4E 47 0D 0A 1A 0A`), de até 2 MB, para um `<id>` da lista fechada; o nome do arquivo enviado nunca vira chave. (about.md RN02)
- Sem R2 configurado, ou com falha do R2, o envio e a remoção falham com mensagem clara; nada é gravado em `public/` nem no MongoDB. (about.md RN03)
- O bezel nunca atrasa nem impede o jogo: falha, 404 ou demora na imagem só deixam a tela sem bezel; a tela de jogo funciona sem MongoDB e sem R2. (about.md RN04)
- O bezel existente vai com `Cache-Control: no-cache` e `ETag`; ausente 404 `no-store`; falha do R2 502 `no-store`. (about.md RN05)
- Bezel só com `(min-width: 1024px) and (pointer: fine)`. (about.md Decisions)
- Não mexer em lib/mongo.ts, lib/admin-login.ts, lib/login-throttle.ts, auth.ts, auth.config.ts, middleware.ts, app/api/auth/**, nem nas rotas admin existentes. Em lib/auth-guard.ts, só usar requireAdmin. (dono, restrição da rodada)
- Em lib/r2.ts, só exportações novas. getR2BucketName e getR2Endpoint têm impacto HIGH no GitNexus (10 callers): usar, nunca alterar. Não reusar uploadRomToR2. (dono, restrição da rodada)
- Medido em 2026-11-09 com o índice refeito em `b8885789`: `getR2BucketName` HIGH, `getR2Endpoint` CRITICAL, `requireAdmin` CRITICAL (10 callers diretos). Todos só usados, nunca editados. (GitNexus `impact` upstream)
- Produção: a tela de jogo funciona sem MongoDB e sem bezel, e /api/rom/[slug] continua pública. (dono, restrição da rodada)
- Testes de servidor com cliente R2 falso injetado; E2E só com page.route em /api/bezel/** e /api/admin/bezels/**; zero gravações no R2 de produção. Não configurar R2 no shell dos testes (tests/rooms-data.test.ts lê o bucket real). (dono, restrição da rodada)
- Qualquer servidor de dev subido para QA usa MONGODB_DB=retrokey_e2e. O E2E roda um projeto por vez (--project=main, depois --project=no-mongo), apagando .next antes, com as portas 3001/3002 livres. (dono, restrição da rodada)
- Nunca imprimir nem commitar valores de .env, .env.local ou cookies.txt (só nomes de variáveis); não abrir esses arquivos. Sem git push sem consentimento do dono. (dono, restrição da rodada)
- A aba Cartridges, suas rotas e `/nfc/[id]` não mudam nesta SF; a remoção delas é trabalho separado. (dono, 2026-11-09, epic.md Notes)

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Aba própria "Bezels" (`components/admin/BezelsTab.tsx`) montada por `app/admin/page.tsx` | Bezel é do console; a aba Cartridges só liga tag NFC a jogo e o dono não a usa | Bloco dentro de `CartridgesTab` (about original) | Decisão do dono, 2026-11-09 |
| `lib/bezel-console.ts` puro (ids, chave, PNG, tamanho, proporção) separado de `lib/bezel.ts` (R2) | Componentes cliente precisam da lista e da checagem de proporção; `lib/r2.ts` puxa `fs` e o SDK S3 | Lista só em `lib/bezel.ts` e opções do admin derivadas à parte — duas fontes para a mesma lista | Lista fechada definida uma vez (Cross-SF rule) |
| Fábricas `createAdminBezelHandlers(deps?)` / `createPublicBezelHandlers(deps?)` em `lib/bezel-routes.ts`; rotas só reexportam os métodos | Testes injetam `getStorage` e `readSession` sem carregar o next-auth (o guard já importa `@/auth` sob demanda) | Setter global no módulo; testar o arquivo de rota direto | Zero gravações no R2 de produção; arquivo de rota só exporta métodos HTTP |
| `createR2Client(): S3Client \| null` novo em `lib/r2.ts` | `hasR2Config()` é privado; o bezel precisa saber "não configurado" sem fallback local | Reusar `uploadRomToR2` (grava em `public/roms` na falha); editar `getR2Endpoint` (impacto CRITICAL medido em 2026-11-09; ver Global Constraints) | about.md Decisions; impacto GitNexus |
| ETag lido de um GetObject e comparado em lib; DELETE faz HeadObject antes | Uma chamada por leitura; DeleteObject do R2 não falha em chave ausente, então o 404 precisa do Head | HeadObject + GetObject na leitura (corrida); `IfNoneMatch` do SDK (formato do erro não verificado) | about.md RN05 e contrato DELETE 404 |
| Pedido que não é multipart ou multipart quebrado → 400; `try/catch` externo com 500 só como defesa | 415 no admin significa "não é PNG"; lib nunca lança | 415 para content-type errado | Contrato HTTP do about.md |
| Layout dos modos por media query no CSS; `useWideScreen` (matchMedia) só decide montar `PlayBezel` | Celular nunca mostra moldura, nem antes da hidratação; nenhum pedido de bezel fora de `Wide` | `<picture><source media>` sem `src` — não decide o modo do quadro | design.md Design Review D3, P2 |
| Bezel adotado só se carrega durante `booting`; depois de `running` a caixa fica fixa | Uma troca no máximo, sem redimensionar o jogo durante a partida | Segurar o skeleton até o bezel — atrasa o jogo; trocar a qualquer momento — instabilidade | about.md RN04; design.md D6, P1 |
| Legenda (espaço da SF02) só em `Wide`; abaixo de 1024px não há legenda | 844×390 com mouse é celular e não pode perder 40px de altura | Manter `pointer:fine` | about.md RF05 (maior área no celular) |
| Skeleton 4/3 com a regra de tamanho da janela | O console é desconhecido em loading-metadata; 4/3 vale para 9 dos 12 consoles | Skeleton na proporção do console (métrica QA-13 literal) — dado indisponível | design.md P3 |
| Variante `wide:` em `tailwind.config.ts` (`raw` media) | Uma classe por regra, sem repetir a media nos componentes | Variantes arbitrárias `[@media(...)]:` em cada classe | Tailwind content scan (wiki frontend.md) |
| Contrato entregue da SF01 sobrescrito pela SF04; docs da SF01 não são editados | A SF01 está convergida e congelada (`checkpoint/0002F-SF01-done`); a lista do que muda fica na linha "Supersedes SF01 clauses" de Requirements Coverage, e T28 é o único lugar onde as asserções da SF01 mudam | Editar about/design/plan da SF01 — reabre um SF fechado | epic.md Notes ("SF04 muda o layout do celular da SF01") |
| T46 do test-spec removido (rotas reais sem `page.route`) | Regra do dono: E2E só com `page.route`; RF03/RN01 seguem cobertos por T04, T07, T08, T09, T45 | Manter T46 | Restrição da rodada |

## Tasks
1. - [ ] backend: cria `tests/bezel.test.ts` com T01-T22 (TDD: cliente R2 falso e `readSession` injetado; cada grupo de módulo carrega o seu com `await import()`), depois `lib/bezel-console.ts` (ids, chave, PNG, tamanho, proporção) — T01, T21, T22 verdes; os demais casos ficam vermelhos até a Task 4 — S
2. - [ ] backend: antes de editar, GitNexus `impact` upstream em `lib/r2.ts` e registrar callers e risco em `subfeatures/SF04-console-bezels/build-ledger.md` (criado nesta task se ainda não existir; mesmo lugar dos registros NOT VERIFIED do `detect-changes`); depois `createR2Client` em `lib/r2.ts` (só export novo) — `npm run build` verde; `git diff lib/r2.ts` sem linha removida — S
3. - [ ] backend: `lib/bezel.ts` (storage, put/get/delete, ETag, erro ausente vs falha) — script descartável em `.codeadd/.temp/` confirma `getBezelStorage()` nulo sem `R2_*`, `isMissingObjectError` e `etagMatches`; os casos de rota T03, T17-T20 ficam verdes na Task 4 — M
4. - [ ] backend: `lib/bezel-routes.ts` + `app/api/admin/bezels/[console]/route.ts` + `app/api/bezel/[console]/route.ts` — T01-T22 de `tests/bezel.test.ts` verdes (T02-T20 passam a verde aqui, inclui T03 e T17-T20); `npm run build` verde; leitura do `matcher` de `middleware.ts` (sem editar) confirma que `/api/bezel/**` fica fora dele, com o resultado registrado no `build-ledger.md` da SF04 — M
5. - [ ] frontend: CR-3 em `components/Emulator.tsx`, `components/useWideScreen.ts`, `components/PlayBezel.tsx`, variante `wide:` em `tailwind.config.ts` — `npm run build` verde — S
6. - [ ] frontend: `ThemedFrame` (modos, skeleton 4/3, Back home no not-found, `px-6`), `StatusStrip`, `PlayTopBar` e `app/globals.css` — `git diff --name-only` lista `components/ThemedFrame.tsx`, `components/StatusStrip.tsx`, `components/PlayTopBar.tsx` e `app/globals.css`; toda regra `[data-frame]` de `app/globals.css` fica dentro de `@media (min-width: 1024px) and (pointer: fine)`; `ACTION_CLASS` usa `px-6`; `npm run build` verde ao fim da Task 7, porque o `PlayStage` só passa a prop `mode` lá — M
7. - [ ] frontend: `PlayStage` (máquina de estado do bezel, legenda em `Wide`, CR-1, CR-2) — `npm run build` verde — M
8. - [ ] frontend: `components/admin/BezelsTab.tsx` + terceira aba em `app/admin/page.tsx` — `npm run build` verde — M
9. - [ ] test: `e2e/play-screen.qa.spec.ts` — migração dos testes da SF01 (T28) e T23-T38 nos projetos `main` e `no-mongo` — M
10. - [ ] test: `e2e/admin.qa.spec.ts` — T39-T45, T47, T48 no projeto `main` — M
11. - [ ] chore: `tests/bezel.test.ts` entra no `test` gate do AGENTS.md — o comando roda os 6 arquivos — S

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Erro do R2 para chave ausente não vem como `NoSuchKey`/`NotFound`/404 | média | bezel ausente vira 502 e a prévia do admin mostra read-error | `isMissingObjectError` aceita os três sinais; T19 trava o contrato; conferir no primeiro envio real do dono |
| R2 não devolve `ETag` | baixa | sem 304; cada abertura baixa o PNG inteiro | a rota omite o header e responde 200; correção não depende do ETag |
| Corpo sem `Content-Length` é lido por `formData()` até o limite do Vercel (~4,5 MB, não verificado) | baixa | memória de uma requisição admin | só admin chega ao `formData()`; `file.size` recusa acima de 2 MB |
| A troca moldura → bezel durante o boot redimensiona o iframe do EmulatorJS | média | canvas pisca uma vez no boot | uma troca só, só em booting; T29 mede; depois de running a caixa fica fixa |
| Migração do E2E da SF01 (`[data-frame]` → `[data-window]`, legenda, Back home duplo) | alta | testes da SF01 quebram | T28 lista cada asserção; Task 9 roda `main` e `no-mongo` |
| Teste em tela larga sem `routeBezel` lê o bucket real se o servidor de dev tiver R2 | média | leitura no R2 de produção durante o E2E | `routeBezel` obrigatório em todo teste `Wide`, incluindo 1280×720 |
| `matcher` de `middleware.ts` cobrir `/api/bezel/**` | baixa (discovery: matcher `/admin/:path*`) | GET passaria a exigir login e o jogo ficaria sem bezel em produção, com todos os testes verdes | Task 4 lê o matcher sem editar e registra o resultado |
| Tailwind 3.4 não aceitar `screens.wide = { raw }` junto das telas padrão | baixa | variante `wide:` não gerada | `npm run build` na Task 5 + checagem do CSS gerado; alternativa: variante arbitrária |
| Proporção do PNG fora de 16:9 | média | arte esticada | aviso no admin (RN06), envio permitido; decisão do dono |
| Envio de bezel sem auditoria | certa | alteração admin sem registro | exclusão explícita até o 0001F-SF03 |

## Validation
- `npm run build` sai com 0 (typecheck incluso).
- `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts` sai com 0, sem variáveis `R2_*` no shell.
- Com `.next` apagado, as portas 3001/3002 livres e `MONGODB_DB=retrokey_e2e`: `npx playwright test e2e/play-screen.qa.spec.ts e2e/admin.qa.spec.ts --project=main`; apagar `.next` de novo; `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`. Todos verdes.
- QA visual (`/add-review`) contra o `## Design Contract` do design.md da SF04 em 390×844, 844×390, 1366×768 e 1920×1080, com baseline SF01:run-001.
- Antes de cada commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`. Um resultado `partial`/`truncated`, ou um índice sem os símbolos, fica registrado como NOT VERIFIED, junto com a lista de `git diff --name-only`.

---

## Test Specification

SF04 console-bezels. Server cases build handlers with `createAdminBezelHandlers` / `createPublicBezelHandlers` (`lib/bezel-routes.ts`) and inject a fake `BezelR2Client` (records every command, scripted per case) plus `readSession`; no case sets `R2_*` env or imports a route file. E2E reaches bezel data only through `page.route` on `/api/bezel/**` and `/api/admin/bezels/**`; every Wide test (1280x720 default, 1366x768, 1920x1080, including the migrated SF01 tests) calls `routeBezel(page, 'missing'|'png'|'error'|'slow')`. "Held ready" = the `/emulator.html` stub posts `EMULATOR_CANVAS_READY` only when the test releases it. E2E titles carry the `SF04-` prefix (`SF04-T23 …`) so they do not clash with the SF01 `T05`-`T17` titles in the same file.

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | backend-RF02-key-per-console-id | backend | RF02 | `bezelObjectKey` for each of `BEZEL_CONSOLE_IDS` | 12 ids = `FRAME_STYLES` minus `neutral`, key `bezels/<id>.png` | deepEqual ids and keys |
| T02 | backend-RF02-upload-stores-png-201 | backend | RF02 | POST `nes`, admin session, 1 KB PNG | 201 `{console:'nes',key:'bezels/nes.png'}` | fake got 1 Put, Key `bezels/nes.png`, ContentType `image/png`, same bytes |
| T03 | backend-RF02-reupload-replaces-same-key | backend | RF02 | POST `nes` twice, bytes A then B; then GET | both 201; GET body = B | Put keys equal; GET bytes equal B |
| T04 | backend-RF03-public-get-returns-png | backend | RF03 | GET `snes`, fake holds object with ETag | 200 `image/png`, `Cache-Control: no-cache`, `ETag`, `Content-Length`, `X-Content-Type-Options: nosniff` | headers + body bytes |
| T05 | backend-RF01-delete-existing-204 | backend | RF01 | DELETE `gba`, admin, Head finds object | 204 empty body | fake got Head then Delete on `bezels/gba.png` |
| T06 | backend-RF01-delete-missing-404 | backend | RF01 | DELETE `gba`, Head throws `NotFound` | 404 `{error:'No bezel for this console'}` | no Delete command sent |
| T07 | backend-RN01-public-read-needs-no-session | backend | RN01 (+) | GET `nes`, injected `readSession` that throws | 200 PNG | `readSession` call count 0 |
| T08 | backend-RN01-no-session-401 | backend | RN01 (−) | POST and DELETE `nes`, `readSession` → null | 401 `{error:'Unauthorized'}` | fake command count 0 |
| T09 | backend-RN01-non-admin-403 | backend | RN01 (−) | POST and DELETE, session role `user` | 403 `{error:'Forbidden'}` | fake command count 0 |
| T10 | backend-RN02-png-at-2mb-accepted-name-ignored | backend | RN02 (+) | POST PNG of exactly 2097152 bytes, filename `../../evil.jpg` | 201, key `bezels/nes.png` | Put Key ignores filename; `hasPngSignature(signature+data)` true |
| T11 | backend-RN02-not-png-415 | backend | RN02 (−) | POST JPEG bytes; 7-byte file; PNG with byte 3 changed | 415 `{error:'File is not a PNG'}` | 0 Put; `hasPngSignature` false |
| T12 | backend-RN02-over-limit-413 | backend | RN02 (−) | file 2097153 bytes; `Content-Length` > `BEZEL_MAX_REQUEST_BYTES` | 413 `{error:'File is over 2 MB'}` | 0 Put; header case answered before body read (body stream never consumed) |
| T13 | backend-RN02-id-outside-list-404 | backend | RN02 (−) | POST/DELETE id `neutral`, `NES`, `../roms/x`, `` | 404 `{error:'Unknown console'}` | 0 commands, no key built |
| T14 | backend-RN02-no-file-400 | backend | RN02 (−) | no `file` field; 0-byte file; JSON content-type; broken multipart | 400 `{error:'No file'}` | 0 Put |
| T15 | backend-RN03-write-goes-only-to-r2 | backend | RN03 (+) | T02 upload with fake storage | 201 and exactly 1 Put | `public/bezels` absent before and after; no Mongo import touched (module has no `lib/mongo` dep) |
| T16 | backend-RN03-no-storage-503 | backend | RN03 (−) | `getStorage` → null; POST and DELETE | 503 `{error:'Storage is not configured'}` | `public/bezels` absent |
| T17 | backend-RN03-r2-failure-502 | backend | RN03 (−) | Put throws; Head throws; Delete throws | 502 `{error:'Storage failed'}` | no file under `public/` |
| T18 | backend-RN05-etag-match-304 | backend | RN05 (+) | GET with `If-None-Match` = ETag, `W/`+ETag, `*`, list containing ETag; then a different tag | 304 no body + ETag + `no-cache`; mismatch → 200 PNG | status, empty body, headers |
| T19 | backend-RN05-missing-404-no-store | backend | RN05 (−) | Get throws `NoSuchKey`; `NotFound`; `$metadata.httpStatusCode` 404; `getStorage` null; id `neutral` | 404 `{error:'Bezel not found'}`, `Cache-Control: no-store` | identical body in all 5 inputs |
| T20 | backend-RN05-r2-failure-502-no-store | backend | RN05 (−) | Get throws `AccessDenied` | 502 `{error:'Storage failed'}`, `no-store` | status ≠ 404 |
| T21 | backend-RN06-aspect-within-tolerance | backend | RN06 (+) | `isBezelAspectOff(1920,1080)`, `(1600,900)`, `(1280,722)` | false | equal false |
| T22 | backend-RN06-aspect-outside-tolerance | backend | RN06 (−) | `isBezelAspectOff(1024,768)`, `(1920,1100)`, `(1080,1920)` | true | equal true |
| T23 | frontend-RF04-bezel-geometry-1366 | frontend | RF04 | 1366x768 fine, `routeBezel png`, held ready, release after bezel `load` | `[data-mode=bezel]`, bezel img `alt=""` `aria-hidden` | area ratio 16/9 ±1px, centered in stage ±2px; window h = area h ±1px, centered x ±2px, ratio 4/3 ±0.01; `[data-frame]` count 0 |
| T24 | frontend-RF04-window-share-per-console-1920 | frontend | RF04 | 1920x1080 fine, png, `/api/game/**` routed to arcade, Game Boy, Game Boy Advance | window w / area w = 0.75, 0.625, 0.84375 | ±0.005 each; window h = area h ±1px |
| T25 | frontend-RF04-no-bezel-keeps-css-frame | frontend | RF04 | 1366x768 fine, `routeBezel missing` | `[data-mode=frame]`, `[data-frame="arcade"]` visible, Running | ratio 4/3 ±0.02, legend visible, no scroll |
| T26 | frontend-RF05-phone-bare-no-bezel | frontend | RF05 | 390x844, 844x390 (fine and touch), 1366x768 touch; `routeBezel png`; running | `[data-mode=bare]`, `[data-frame]` 0, no bezel img | 0 requests to `/api/bezel/**`; window 4/3 ±0.02 and fills stage on one axis ±2px; `scrollHeight ≤ innerHeight`; Back home ≥44px; legend hidden |
| T27 | frontend-RF05-phone-status-hidden-when-running | frontend | RF05 | 390x844: running; then `/api/game/**` aborted (metadata-error) | running: `role=status` mounted, text visually hidden; error: strip visible with text | status box ≤1px in running; strip `position:absolute`; window box equal in booting and running (0px) |
| T28 | frontend-RF05-sf01-assertions-migrated | frontend | RF05 | existing SF01 T05/T06/T07/T17 in `play-screen.qa.spec.ts` | locators use `[data-window]`; phone runs assert `[data-frame]` 0; fine 390x844/844x390 legend hidden, 1366x768 visible; T17 Back home checked inside the panel; neutral `[data-frame]` only in Wide | migrated tests pass in `main` and `no-mongo` |
| T29 | frontend-RN04-bezel-before-running-adopted-once | frontend | RN04 (+) | 1366x768, png, held ready; MutationObserver on `data-mode` | mode sequence `[frame, bezel]`, switch while status is Starting game; game reaches Running | 1 switch; window box delta 0px for 1 s after Running |
| T30 | frontend-RN04-bezel-error-never-blocks | frontend | RN04 (−) | 1366x768, `routeBezel` 404, 500, aborted | Running, `[data-mode=frame]` | no `role=alert` and no bezel text; status `Running` |
| T31 | frontend-RN04-slow-bezel-refused-after-running | frontend | RN04 (−) | 1366x768, bezel delayed 3 s, ready not held | Running before bezel arrives; mode stays `frame` | after +3.5 s mode `frame`, window box delta 0px |
| T32 | frontend-RN04-play-works-without-mongo-and-r2 | frontend | RN04 (−) | `--project=no-mongo` run, `routeBezel missing` | Running with CSS frame | status `Running`, no alert |
| T33 | frontend-QA04-panel-actions-px-6 | frontend | QA-04 | metadata-error (Retry), not-found (panel Back home) | padding-left/right 24px | computed style on both buttons |
| T34 | frontend-QA08-not-found-panel-back-home | frontend | QA-08 | `/play/e2e-sf01-no-such-game` | panel shows link "Back home" `href="/"` | visible inside panel; Retry/Reload count 0; iframe 0 |
| T35 | frontend-QA10-QA12-title-scale | frontend | QA-10, QA-12 | 390x844, 844x390, 1366x768; `/api/game/**` with 80-char title | title 18px phone, 24px Wide, one line with ellipsis; system label hidden phone, visible Wide | computed `font-size`, `white-space:nowrap`, `text-overflow:ellipsis`, title height = 1 line |
| T36 | frontend-QA11-axe-loading-metadata | frontend | QA-11 | `/api/game/**` held pending, skeleton shown | 0 axe violations | AxeBuilder full run |
| T37 | frontend-QA13-skeleton-4-3-same-size-rule | frontend | QA-13, QA-09 | 390x844 and 1366x768, game held then released | skeleton ratio 4/3 ±0.02; at 390x844 skeleton box = running window box ±2px | boundingBox in loading vs running |
| T38 | frontend-CR2-no-system-warning-while-loading | frontend | CR-2 | collect console from `goto` until Running | no `No system selected` message | console log filter count 0 |
| T39 | frontend-RF01-bezels-tab-placement | frontend | RF01 | admin logged in; click tab "Bezels"; then tab "Cartridges" | tab bar = Games, Cartridges, Bezels; Bezels shows heading "Bezel por console" and a select with 12 options, values = ids; Cartridges tab has no bezel block | tab button order; option values; Cartridges headings equal pre-SF04 ("Create new cartridge", "Cartridges list") |
| T40 | frontend-RF01-current-preview-states | frontend | RF01 | `GET /api/bezel/<id>` first held (checking: 16:9 skeleton captured), then routed 200 PNG, 404, 502 then 200 | has-bezel img + Remove enabled; "No bezel for this console yet." + Remove disabled; "Could not read this bezel." + Try again → has-bezel | GET count 2 after Try again; Upload enabled in read-error |
| T41 | frontend-RF01-stale-console-response-dropped | frontend | RF01 | `nes` GET delayed 200; switch to `snes` (404) | shows empty state of `snes` | late `nes` response does not change preview |
| T42 | frontend-RF01-RF02-upload-success-replaces | frontend | RF01, RF02, RN06 (+) | console in has-bezel (image A); choose 1920x1080 PNG B; POST routed 201 (held, then released); next GET serves B | no aspect warning; while held "Uploading..." and select/file/Upload/Remove disabled; then `role=status` "Bezel saved for {label}." | POST is multipart with field `file`; input cleared; new GET with `?v=`; preview shows image B (natural size of B) |
| T43 | frontend-RF01-upload-error-messages | frontend | RF01 | POST routed 400, 404, 413, 415, 502, 503, aborted | `role=alert` with design.md text per status ("Could not reach the server." on abort) | file kept, Upload enabled |
| T44 | frontend-RF01-remove-bezel | frontend | RF01 | has-bezel; Remove; dialog accept / dismiss; DELETE 204, 404, 502, 503 | dialog "Remove the bezel for {label}?"; 204 → "Bezel removed for {label}." + empty; errors → `role=alert`, back to has-bezel | dismiss sends 0 DELETE; "Removing..." disables all controls |
| T45 | frontend-RN01-admin-401-403-raise-auth-error | frontend | RN01 (−) | POST and DELETE routed 401, 403 | existing session-expired panel shown | same panel as CartridgesTab auth error |
| T47 | frontend-RN06-off-ratio-warns-still-uploads | frontend | RN06 (−) | choose 1024x768 PNG | amber `role=status` text with "1024×768", not 16:9 | Upload enabled; click sends 1 POST |
| T48 | frontend-RF01-bezel-block-a11y | frontend | RF01 | states empty, has-bezel, read-error, file-selected, aspect-warning, upload-error | 0 axe violations | `target-size` ≥44px on select, file label, Upload, Remove, Try again |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend (lib + route factories) | `tests/bezel.test.ts` (new; add to `validation_gates.test` list) | T01-T22 |
| frontend (play screen) | `e2e/play-screen.qa.spec.ts` (existing; add `routeBezel`, held-ready stub, `[data-window]` helpers) | T23-T38 |
| frontend (admin block) | `e2e/admin.qa.spec.ts` (existing, `main project` describe; T03 "all 10 admin routes" count unchanged) | T39-T45, T47, T48 |

### Coverage vs Requirements
| RF/RN | Test Cases | Status |
|-------|------------|----------|
| RF01 | T05, T06, T39, T40, T41, T42, T43, T44, T48 | ✅ |
| RF02 | T01, T02, T03, T42 | ✅ |
| RF03 | T04, T07 | ✅ |
| RF04 | T23, T24, T25 | ✅ |
| RF05 | T26, T27, T28 | ✅ |
| RN01 | (+) T07, T02 · (−) T08, T09, T45 | ✅ |
| RN02 | (+) T10 · (−) T11, T12, T13, T14 | ✅ |
| RN03 | (+) T15 · (−) T16, T17 | ✅ |
| RN04 | (+) T29 · (−) T30, T31, T32 | ✅ |
| RN05 | (+) T18 · (−) T19, T20 | ✅ |
| RN06 | (+) T21, T42 · (−) T22, T47 | ✅ |
| review-001 QA-04, QA-08, QA-09, QA-10/QA-12, QA-11, QA-13, CR-2 | T33, T34, T26+T37, T35, T36, T37, T38 | ✅ |
| review-001 CR-1, CR-3 | no runtime signal (unreachable branch, type name); checked in code review and by `next build` typecheck | review-only |
| Metric: 0 writes to production R2 | T02-T20 use the injected fake only; T23-T48 route every bezel call (no T46: E2E reaches bezel routes only through `page.route`, owner rule) | ✅ |

Coverage: 11/11 RF/RN (100%) · review-001 in scope: 8/10 with a test signal, CR-1 and CR-3 review-only.

---

## Backend

SF04 console-bezels. No MongoDB, no `public/` fallback, no command layer, no DI container. R2 key `bezels/<id>.png` is the only record. HTTP lives in route factories in `lib/` (precedent: `lib/auth-guard.ts` returns `NextResponse` and takes an injectable `SessionReader`).

### Endpoints
| Method | Path | Request DTO | Response DTO | Status | Purpose |
|--------|------|-------------|--------------|--------|---------|
| POST | `/api/admin/bezels/[console]` | UploadBezelDto (multipart, field `file`) | BezelUploadResponseDto / ErrorDto | 201; 401, 403 (requireAdmin); 404 id outside list; 503 R2 not configured; 413 Content-Length or file.size over limit; 400 not multipart, unparsable form or no file; 415 no PNG signature; 502 Put failed; 500 outer catch only | Store or replace the console bezel |
| DELETE | `/api/admin/bezels/[console]` | — | empty / ErrorDto | 204; 401, 403; 404 id outside list or Head says missing; 503; 502 Head/Delete failed; 500 outer catch | Remove the console bezel |
| GET | `/api/bezel/[console]` | header `If-None-Match` (optional) | PNG bytes / empty (304) / ErrorDto | 200 `image/png` + `Cache-Control: no-cache` + `ETag` + `Content-Length` + `X-Content-Type-Options: nosniff`; 304 (ETag, no-cache, no body); 404 fixed body `no-store` (id outside list, R2 not configured, NoSuchKey); 502 `no-store` | Public read for play screen and admin preview |

Check order, POST: `requireAdmin(request, deps.readSession)` → `isBezelConsoleId` → `deps.getStorage()` null → 503 → `Content-Length` header present and `> BEZEL_MAX_REQUEST_BYTES` → 413 (before `formData()`) → content-type lacks `multipart/form-data` → 400 → `request.formData()` throws → 400 → `file` not a `File` or `size === 0` → 400 → `file.size > BEZEL_MAX_BYTES` → 413 (before `arrayBuffer()`) → `new Uint8Array(await file.arrayBuffer())` → `!hasPngSignature` → 415 → `putBezel` → 201/502. `file.name` is never read. DELETE: auth → id → storage → `deleteBezel`. GET: id → storage → `getBezel(storage, id, request.headers.get('if-none-match'))`.
Body bound: with a `Content-Length` the request is refused unread; a chunked body without it is buffered by `formData()` up to the Vercel platform cap (~4.5 MB, UNVERIFIED), then refused by `file.size`.

### DTOs
| DTO | Fields | Validations |
|-----|--------|-------------|
| BezelConsoleParam | `params.console: string` | `isBezelConsoleId` (exact match to one of 12 ids, case-sensitive) else 404 |
| UploadBezelDto | `file: File` (multipart) | present, `size > 0` (400); `size <= 2097152` (413); first 8 bytes `89 50 4E 47 0D 0A 1A 0A` (415); filename ignored |
| BezelUploadResponseDto | `{ console: BezelConsoleId; key: string }` | key = `bezelObjectKey(id)` |
| ErrorDto | `{ error: string }` | fixed strings: POST/DELETE id outside list 404 `'Unknown console'`; GET every 404 `'Bezel not found'`; DELETE missing 404 `'No bezel for this console'`, 400 `'No file'`, 415 `'File is not a PNG'`, 413 `'File is over 2 MB'`, 503 `'Storage is not configured'`, 502 `'Storage failed'`, 500 `'Failed to save bezel'` / `'Failed to remove bezel'` / `'Failed to read bezel'` |

#### lib exports (exact signatures)
| File | Export |
|---|---|
| `lib/r2.ts` (new only) | `export function createR2Client(): S3Client \| null` — returns null when the private `hasR2Config()` is false; otherwise the same `S3Client` config the file already builds. Existing functions untouched. |
| `lib/bezel-console.ts` (pure: imports only `lib/play-theme.ts`; safe in client components) | `export type BezelConsoleId = Exclude<FrameStyle, 'neutral'>` |
| | `export const BEZEL_CONSOLE_IDS: readonly BezelConsoleId[]` = `FRAME_STYLES` minus `'neutral'` (12, order of FRAME_STYLES) |
| | `export function isBezelConsoleId(value: unknown): value is BezelConsoleId` |
| | `export function bezelObjectKey(id: BezelConsoleId): string` → `bezels/${id}.png` |
| | `export const BEZEL_MAX_BYTES = 2097152` ; `export const BEZEL_MAX_REQUEST_BYTES = BEZEL_MAX_BYTES + 65536` (multipart overhead) |
| | `export const PNG_SIGNATURE: readonly number[]` ; `export function hasPngSignature(bytes: Uint8Array): boolean` |
| | `export const BEZEL_ASPECT_TOLERANCE = 0.02` ; `export function isBezelAspectOff(width: number, height: number): boolean` — `Math.abs(width / height - 16 / 9) > BEZEL_ASPECT_TOLERANCE` (RN06, used by the admin block) |
| `lib/bezel.ts` (server only: imports `lib/r2.ts` and `lib/bezel-console.ts`) | `export function isMissingObjectError(error: unknown): boolean` — true when `name` is `'NoSuchKey'` or `'NotFound'`, or `$metadata.httpStatusCode === 404` |
| | `export function etagMatches(ifNoneMatch: string \| null, etag: string \| null): boolean` — false if either null; `*` matches; comma list; `W/` prefix ignored |
| | `export type BezelR2Client = Pick<S3Client, 'send'>` ; `export type BezelStorage = { client: BezelR2Client; bucket: string }` |
| | `export function getBezelStorage(): BezelStorage \| null` — `createR2Client()` + `getR2BucketName()`; null = not configured |
| | `export type BezelWriteResult = { kind: 'saved'; key: string } \| { kind: 'failed' }` |
| | `export type BezelReadResult = { kind: 'found'; body: Uint8Array; etag: string \| null; contentLength: number } \| { kind: 'not-modified'; etag: string } \| { kind: 'missing' } \| { kind: 'failed' }` |
| | `export type BezelDeleteResult = { kind: 'deleted' } \| { kind: 'missing' } \| { kind: 'failed' }` |
| | `export async function putBezel(storage: BezelStorage, id: BezelConsoleId, bytes: Uint8Array): Promise<BezelWriteResult>` — PutObject `ContentType: 'image/png'` |
| | `export async function getBezel(storage: BezelStorage, id: BezelConsoleId, ifNoneMatch: string \| null): Promise<BezelReadResult>` — one GetObject; ETag from `response.ETag`; on `etagMatches` returns not-modified without reading the body (calls `Body.destroy?.()`); else `transformToByteArray()` |
| | `export async function deleteBezel(storage: BezelStorage, id: BezelConsoleId): Promise<BezelDeleteResult>` — HeadObject (missing → `missing`) then DeleteObject; R2 DeleteObject succeeds on absent keys, so Head is the only way to return 404 |
| `lib/bezel-routes.ts` | `export type BezelRouteContext = { params: { console: string } }` |
| | `export type BezelRouteDeps = { getStorage: () => BezelStorage \| null; readSession?: SessionReader }` |
| | `export function createAdminBezelHandlers(deps?: Partial<BezelRouteDeps>): { POST: (request: Request, context: BezelRouteContext) => Promise<Response>; DELETE: (request: Request, context: BezelRouteContext) => Promise<Response> }` |
| | `export function createPublicBezelHandlers(deps?: Partial<BezelRouteDeps>): { GET: (request: Request, context: BezelRouteContext) => Promise<Response> }` — default `getStorage = getBezelStorage`, default `readSession` = requireAdmin's own default |

ETag choice: conditional check on the single GetObject response (not HeadObject + GetObject, not SDK `IfNoneMatch`). One R2 call per read, no race between two calls, the fake client returns one object shape, and it does not rely on the unverified SDK `NotModified` error shape. Cost: a 304 opens the object stream and drops it (≤2 MB, bounded). lib functions never throw: every SDK error maps to `missing` or `failed`.

### Commands
none — route handlers call lib directly (project has no command layer)

### Events
none — no consumers; no audit until 0001F-SF03 (about.md exclusion)

### Workers (if applicable)
none

### Module Structure
```
lib/r2.ts                                  MODIFY (add createR2Client only)
lib/bezel-console.ts                       CREATE (pure: ids, key, size/PNG/aspect checks; shared with components)
lib/bezel.ts                               CREATE (server: storage seam, put/get/delete over BezelStorage)
lib/bezel-routes.ts                        CREATE (handler factories, status mapping, headers, logs)
app/api/admin/bezels/[console]/route.ts    CREATE  runtime='nodejs'; const handlers = createAdminBezelHandlers(); export const POST = handlers.POST; export const DELETE = handlers.DELETE
app/api/bezel/[console]/route.ts           CREATE  runtime='nodejs'; dynamic='force-dynamic'; const handlers = createPublicBezelHandlers(); export const GET = handlers.GET
tests/bezel.test.ts                        CREATE  fake BezelR2Client recording commands; readSession injected; never sets R2 env
```
Route files export only HTTP methods + `runtime`/`dynamic` (Next.js rule); tests import `lib/bezel-routes.ts`, never the route files, so next-auth never loads. Logs: `[r2]` in `lib/bezel.ts` (key + `error.name` only), `[bezel]` in `lib/bezel-routes.ts` (id + status); never bytes, filenames, credentials or session data.

Reference: `app/api/rom/[slug]/route.ts` (GetObject, headers, fixed 404), `app/api/admin/games/route.ts` (multipart), `app/api/admin/cartridges/route.ts` (requireAdmin first), `lib/auth-guard.ts` (injectable SessionReader), `lib/r2.ts` (S3Client config), `tests/r2-rom.test.ts`

---

## Frontend

SF04 console-bezels. Layout, tokens, states, copy and geometry: `subfeatures/SF04-console-bezels/design.md` (Screens, Components, Tokens, Design Contract). This plan fixes files, signatures and the mechanism only. No new route, no data-fetching library, no store: local `useState` like the SF01 play stage and the admin tabs.

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| `/play/[slug]` | `app/play/[slug]/page.tsx` (unchanged) → `PlayStage` | Wide + bezel / Wide frame / phone bare (design.md Screens) |
| `/admin` (new tab Bezels) | `app/admin/page.tsx` (changed: `activeTab` gains `'bezels'`, third tab button "Bezels") → `BezelsTab` | Block "Bezel por console" (design.md Screens, admin states table) |

### Components
{"PlayBezel":{"location":"components/PlayBezel.tsx","purpose":"NEW: bezel img, reports load or failure, no own state"},"useWideScreen":{"location":"components/useWideScreen.ts","purpose":"NEW: matchMedia Wide flag, false on first render"},"BezelsTab":{"location":"components/admin/BezelsTab.tsx","purpose":"NEW: admin tab; read, upload, remove of one console bezel"},"PlayStage":{"location":"components/","purpose":"bezel state machine, frame mode, legend Wide-only, CR-1, CR-2"},"ThemedFrame":{"location":"components/","purpose":"mode frame|bezel|bare, bezel slot, 4/3 skeleton, not-found Back home"},"StatusStrip":{"location":"components/","purpose":"phone overlay strip, Wide in-flow row; signature unchanged"},"PlayTopBar":{"location":"components/","purpose":"title text-lg/wide:text-2xl, system label Wide-only; signature unchanged"},"Emulator":{"location":"components/","purpose":"CR-3 only: onStatusChange typed with EmulatorStatus"},"AdminPage":{"location":"app/admin/page.tsx","purpose":"third tab Bezels mounts BezelsTab; Games and Cartridges unchanged"}}

### Exported signatures (exact)
| File | Export |
|---|---|
| `components/useWideScreen.ts` | `export const WIDE_MEDIA_QUERY = '(min-width: 1024px) and (pointer: fine)'` ; `export default function useWideScreen(): boolean` — `useState(false)`, effect reads `matchMedia(WIDE_MEDIA_QUERY).matches` and subscribes `change` (removes on unmount) |
| `components/PlayBezel.tsx` | `interface PlayBezelProps { consoleId: BezelConsoleId; onLoaded: () => void; onFailed: () => void }` ; `export default function PlayBezel({ consoleId, onLoaded, onFailed }: PlayBezelProps)` — one `<img className="play-bezel-img" src={\`/api/bezel/${consoleId}\`} alt="" aria-hidden="true">`, no `loading="lazy"` (must load while hidden); `onLoad` → `onLoaded()` when `naturalWidth > 0` else `onFailed()`; `onError` → `onFailed()` |
| `components/ThemedFrame.tsx` | `export type PlayFrameMode = 'frame' \| 'bezel' \| 'bare'` ; props `{ frameStyle: FrameStyle; mode: PlayFrameMode; state: PlayScreenState; onRetry?: () => void; onReload?: () => void; bezel?: ReactNode; children?: ReactNode }` ; default export name unchanged |
| `components/admin/BezelsTab.tsx` | `interface BezelsTabProps { onAuthError: (status: AdminAuthStatus) => void }` ; `export default function BezelsTab({ onAuthError }: BezelsTabProps)` — same callback type as `GamesTab` / `CartridgesTab` |
| `app/admin/page.tsx` | `activeTab` state type `'games' \| 'cartridges' \| 'bezels'`; third tab button "Bezels" (same class as the other two); `{activeTab === 'bezels' && <BezelsTab onAuthError={setAuthError} />}`; no export change |
| `components/Emulator.tsx` | `onStatusChange?: (state: EmulatorStatus, attempt: number, total: number, core: string) => void;` (CR-3, no other change) |
| `PlayStage`, `StatusStrip`, `PlayTopBar` | props and exports unchanged; `CartridgesTab` not touched |
| `tailwind.config.ts` | `theme.extend.screens.wide = { raw: '(min-width: 1024px) and (pointer: fine)' }` → `wide:` variant (same string as `WIDE_MEDIA_QUERY` and the CSS media; three literal copies, no shared import across config/CSS/TS) |

### ThemedFrame DOM (stable tree, so the bezel img never remounts on adoption)
`div.play-frame-area[data-mode=<mode>]` > `div.play-bezel-area` > [`bezel` slot, `div.play-window[data-window=<mode>]` (+ `data-frame={frameStyle}` only when mode is `frame`) > inner `div.relative.h-full.w-full.overflow-hidden.bg-black` (`rounded` only in `frame`) > children + StatePanel]. `loading-metadata`: `div.play-frame-area` > `div.play-skeleton[aria-hidden]` (`bg-zinc-900 motion-safe:animate-pulse`). StatePanel: `ACTION_CLASS` `px-5` → `px-6` (QA-04); not-found adds `<Link href="/" className={ACTION_CLASS}>Back home</Link>` (QA-08).

### app/globals.css (inside `@layer components`)
- Unscoped (phone `bare` is the default, so pre-hydration and stale renders are never decorated): `.play-frame-area{container-type:size; display:flex; align-items:center; justify-content:center; min-height:0; flex:1}`; `.play-bezel-area{display:contents}`; `.play-bezel-img{display:none}`; `.play-window{position:relative; aspect-ratio:var(--t-ar); width:min(100cqw, calc(100cqh * var(--t-ar))); max-width:100%; max-height:100%}`; `.play-skeleton{aspect-ratio:4/3; width:min(100cqw, calc(100cqh * 4 / 3)); max-width:100%; max-height:100%}`.
- Under `@media (min-width: 1024px) and (pointer: fine)` only: `.play-frame-area[data-mode='frame']{padding:8px}`; every existing `[data-frame]` rule moves here and loses its sizing lines (keeps box-sizing, padding clamp, background, border, radius, transition, per-console backgrounds, neutral shadow); `.play-frame-area[data-mode='bezel'] .play-bezel-area{display:flex; position:relative; justify-content:center; aspect-ratio:16/9; width:min(100cqw, calc(100cqh * 16 / 9)); max-width:100%; max-height:100%}`; `… .play-bezel-img{display:block; position:absolute; inset:0; width:100%; height:100%; object-fit:fill}`; `… .play-window{height:100%; width:auto; max-width:none}` (window drawn above img by DOM order; bands = stage `--t-bg`).
- `prefers-reduced-motion` rule on `[data-frame]` kept.

### Hooks & State
{"hooks":{"useWideScreen":"decides only whether PlayBezel mounts and the frame mode; layout itself follows the CSS media (design.md D3)"},"stores":"none","PlayStage local state":{"wide":"useWideScreen()","bezel":"'none'|'pending'|'adopted'|'refused' (internal type BezelState, initial 'none'; not reset by Reload)","statusRef":"useRef<EmulatorStatus>('booting'), written in handleStatusChange and handleReload","bezelId":"ready && theme.frame !== 'neutral' ? theme.frame : null (narrows to BezelConsoleId, type-only import)","frameMode":"!wide ? 'bare' : bezel === 'adopted' ? 'bezel' : 'frame'","mountBezel":"wide && ready && bezelId !== null && (bezel === 'pending' || bezel === 'adopted') → <PlayBezel> passed as ThemedFrame `bezel`","transitions":"effect [wide, ready, bezelId, emulator.state, bezel]: 'none' + wide + bezelId + state 'booting' → 'pending'; 'none'|'pending' + state not 'booting' → 'refused'. onLoaded: pending → statusRef.current === 'booting' ? 'adopted' : 'refused'. onFailed: pending → 'refused'. adopted/refused are final for the mount (PlayStage keyed by slug)","CR-1":"screenState = metaState === 'ok' ? emulator.state : META_TO_SCREEN[metaState]","CR-2":"core = useMemo(() => (ready ? getCoreForSystem(system) : ''), [ready, system])","legend":"className 'hidden h-10 shrink-0 wide:block' (was pointer:fine)","touch-overlay":"unchanged ([@media(pointer:coarse)])"},"StatusStrip classes":"base: absolute inset-x-0 bottom-0 h-8 pointer-events-none bg-[color:var(--t-bg)]; running: bg-transparent + text sr-only; wide: static shrink-0 bg-transparent, running text wide:not-sr-only text-xs muted; role=status node always mounted; placed before touch-overlay in DOM (layer order)","PlayTopBar classes":"h1 'truncate text-lg font-semibold wide:text-2xl' (drop sm:text-2xl and max-height variants, QA-10); system label 'hidden wide:block' (QA-12)","BezelsTab local state":{"consoleId":"BezelConsoleId, first option","preview":"{kind:'checking'}|{kind:'empty'}|{kind:'has-bezel'; url:string}|{kind:'read-error'}","previewVersion":"number, Date.now() after 201 and on Try again","file":"{file:File; url:string; width:number; height:number}|null","busy":"'idle'|'uploading'|'removing'","feedback":"{tone:'success'|'error'|'warning'; text:string}|null"}}

### Admin client calls (BezelsTab)
- Options: built once from `systemOptions` (lib/emulator-cores) + `DEFAULT_PLAY_THEMES[value].frame`, kept only when `isBezelConsoleId(frame)` (from the pure `lib/bezel-console.ts`) → `{ value: BezelConsoleId; label: string }[]` (12, label = system label). Ids, type, guard and the aspect check live once in `lib/bezel-console.ts` (no R2 import), shared by routes and components.
- Read: on `[consoleId, previewVersion]` → `fetch(\`/api/bezel/${consoleId}?v=${previewVersion}\`, { cache: 'no-store', signal })`; 200 → `blob()` → `URL.createObjectURL` → has-bezel; 404 → empty; other status or throw → read-error. AbortController per run plus id compare, so a response for a previous console is dropped (D16).
- Upload: `const body = new FormData(); body.append('file', file)`; `fetch(\`/api/admin/bezels/${consoleId}\`, { method: 'POST', body })`, no `Content-Type` header (browser sets the boundary). `getAdminAuthStatus(response)` → `onAuthError(status)` and stop. 201 → success, input reset, previewVersion bump; else message by status (design.md status table).
- Remove: `confirm(\`Remove the bezel for ${label}?\`)` → `fetch(\`/api/admin/bezels/${consoleId}\`, { method: 'DELETE' })`; 401/403 → `onAuthError`; 204 → removed, preview empty; else delete-error text.
- File: `accept="image/png"`; object URL for the "New file" preview; natural size via `new Image()` on that URL (`naturalWidth`/`naturalHeight`); warning when `isBezelAspectOff(w, h)` (lib/bezel-console.ts, RN06). Every object URL (preview and new file) is revoked on replace, console change, success and unmount.

### Types (mirror from backend)
{"BezelConsoleId":{"fields":"Exclude<FrameStyle,'neutral'> — from lib/bezel-console.ts (pure module, client-safe)","sourceDTO":"BezelConsoleParam"},"BezelUploadResponse":{"fields":"{ console: BezelConsoleId; key: string } — body not read by the UI (status drives the state)","sourceDTO":"BezelUploadResponseDto"},"AdminApiErrorBody":{"fields":"existing { error?: string } — not shown; UI copy comes from design.md","sourceDTO":"ErrorDto"}}

### E2E impact (e2e/play-screen.qa.spec.ts; IDs from test-spec)
- Every Wide test (default 1280x720, 1366x768, 1920x1080) needs `page.route('**/api/bezel/**')` (404 or fixture PNG): a dev server with R2 env would otherwise read the real bucket. New helper `routeBezel(page, 'missing' | 'png' | 'error' | 'slow')`.
- `openRunning` and `frameRatio`: `[data-frame="arcade"]` / `[data-frame]` → `[data-window]` (present in all modes); T07 iframe locator `[data-window] iframe`.
- T05/T06 at 390x844 and 844x390 (fine and touch) and 1366x768 touch: assert `[data-frame]` count 0, window ratio 4/3, no scroll, no `/api/bezel/**` request.
- Legend rule: fine pointer 390x844 and 844x390 → legend hidden (was visible); 1366x768 fine → visible; touch → hidden.
- T17 not-found: two "Back home" links now (top bar + panel) → scope the visible check to the panel; T17 metadata-error keeps `[data-frame="neutral"]` only in Wide.
- New cases (design.md Design Contract): bezel geometry 1366x768/1920x1080; bezel 404/500/3 s delay → running with frame (stub emulator timing); single frame→bezel switch in booting; loading-metadata axe (QA-11); status `sr-only` in phone running; Bezels tab states in e2e/admin.qa.spec.ts with `page.route` on `/api/admin/bezels/**` and `/api/bezel/**`.

### Resolved questions
- OQ-1: `lib/bezel.ts` imports `lib/r2.ts` (`fs`, `@aws-sdk/client-s3`), so a client component cannot import values from it. Resolved: `BezelConsoleId`, `BEZEL_CONSOLE_IDS`, `isBezelConsoleId`, `bezelObjectKey`, size/PNG constants and `isBezelAspectOff` live in the pure `lib/bezel-console.ts`; components import only from there.
- Confirm copy: "Remove the bezel for {label}?" (added to design copy by the plan).

Reference: `components/admin/CartridgesTab.tsx` (card, `getAdminAuthStatus`, `confirm`), `components/admin/GamesTab.tsx` (`systemOptions` select), SF01 `components/PlayStage.tsx` / `ThemedFrame.tsx`, `app/globals.css` container-query frame sizing

---

## QA/E2E Specification

Scope: SF04 console-bezels. Source: `subfeatures/SF04-console-bezels/design.md` (4 screens), `about.md` RF01-RF05/RN01-RN06, `## Test Specification` in this plan.md, T23-T48. Harness for every row: dev server with `MONGODB_DB=retrokey_e2e`; bezel data only via `page.route` on `/api/bezel/**` and `/api/admin/bezels/**` (0 real R2 writes); running state via the existing `page.route` stub of `/emulator.html` (held-ready variant: posts `EMULATOR_CANVAS_READY` only when the test releases it).

| ID | surface | SF | reachability | viewports | capture states | UX acceptance | functional scenario | a11y |
|----|---------|----|--------------|-----------|----------------|---------------|---------------------|------|
| QA02 | play-wide-bezel | SF04 | route `/play/super-retro`, `auth: false`, Wide (`min-width:1024px` + `pointer:fine`); `/api/bezel/**` routed to fixture PNG; held-ready stub, released after bezel `load`; `/api/game/**` routed per console for the 4/3, 10/9, 3/2 cases | 1366x768, 1920x1080 (design override) | default (booting: frame then bezel), success (running, bezel adopted), error (failed with bezel) | 16:9 area ±1px centered both axes ±2px, bands `--t-bg`; window h = area h ±1px, centered x ±2px, ratio `--t-ar` ±0.01; 1920x1080 window 1440/1200/1620 wide; 0 `[data-frame]`; one frame→bezel switch only in booting, 0px box change after running; legend + status `h-8` in flow; no scroll | not a data-entity surface — no CRUD. G png + held ready W bezel loads before release T mode sequence frame→bezel once, reaches Running (T23, T24, T29). G bezel slow 3 s, ready not held T Running first, mode stays frame, box delta 0 (T31). | bezel img `alt=""` + `aria-hidden`; axe 0 violations in booting, running, failed; `role="status"` always mounted; 44px targets (Back home, Reload, fullscreen-slot) |
| QA03 | play-wide-no-bezel | SF04 | route `/play/super-retro`, Wide; `/api/bezel/**` routed 404, 500, aborted; not-found via unknown slug; metadata-error via aborted `/api/game/**`; loading-metadata via `/api/game/**` held; `no-mongo` project for RN04 | 1366x768, 1920x1080 (design override) | default (loading-metadata, booting), error (not-found, metadata-error, failed), success (running, bezel refused) | SF01 CSS frame unchanged: `[data-frame]` with `--t-ar`; skeleton 4/3 with window size rule (QA-13); not-found panel shows Back home button, top-bar Back home is a text link (1 primary CTA per state, QA-08); panel actions `px-6` = 24px (QA-04); title `text-2xl` one line ellipsis, system label `text-xs` visible | not a data-entity surface — no CRUD. G bezel 404/500/abort T Running, frame mode, no alert, no bezel text (T25, T30). G no-mongo + bezel missing T Running with frame (T32). G unknown slug T panel Back home `href="/"`, 0 iframe (T34). G loading T no `No system selected` console log (T38). | axe 0 violations in loading-metadata (QA-11, T36), not-found, booting, running, failed; errors `role="alert"`; `color-contrast` ≥4.5:1; `target-size` 44px + 8px gap; `prefers-reduced-motion` disables skeleton pulse |
| QA04 | play-phone | SF04 | route `/play/super-retro`, outside Wide (390x844, 844x390 with fine and touch pointer; 1366x768 touch); `/api/bezel/**` routed to PNG to prove 0 requests; metadata-error via aborted `/api/game/**` | 390x844, 844x390 (design override) | default (loading-metadata, booting), error (not-found, metadata-error, failed), success (running) | `bare` mode: 0 bezel img, 0 `[data-frame]`, no border/padding; window is the largest `--t-ar` box in the stage, centered, fills one axis ±2px; `scrollHeight ≤ innerHeight`; no legend; top bar = Back home + title `text-lg` (never `text-base`, QA-10) one line ellipsis + fullscreen-slot, system label hidden (QA-12); status strip `absolute` bottom `h-8` `--t-bg`, never moves the window; skeleton 4/3 box = running window box ±2px | not a data-entity surface — no CRUD. G png routed W running T `[data-mode=bare]`, 0 `/api/bezel/**` requests (T26). G running T status text visually hidden, node mounted; G metadata-error T strip visible with text, window box equal booting/running (T27). G 80-char title T 18px one line ellipsis (T35). G SF01 T05/T06/T07/T17 migrated to `[data-window]` (T28). | `role="status"` mounted in all states (sr-only in running); status text ≥4.5:1 on `--t-bg`; Back home ≥44px; axe 0 violations in loading-metadata, running, failed |
| QA05 | admin-bezels-tab | SF04 | non-route: existing E2E admin login (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, as `e2e/admin.qa.spec.ts`) → `/admin` → third tab button "Bezels" → "Bezel por console" card (Cartridges tab unchanged); `/api/bezel/**` and `/api/admin/bezels/**` routed per state | 390x844, 1366x768 | list (12-console select), empty, detail (has-bezel), filled (file-selected, aspect-warning), submitted (uploading, removing), created (success), deleted (removed), error (read-error, upload-error, delete-error) | card `rounded-2xl p-6`, `gap-4`; order: select, current preview + Remove, file label, new-file preview, warning, Upload, feedback right below Upload; previews 16:9 on zinc-900/800 checker; checking = 16:9 `motion-safe:animate-pulse` skeleton; Upload is the only primary (cyan-500); warning amber-300, success cyan-400, error red-400; error copy per design.md status table; cartridge form unchanged | **List:** tab bar has Games, Cartridges, Bezels; Bezels tab shows the card; select has 12 options, values = frame ids; Cartridges tab content unchanged (T39). **Read:** GET 200 → preview + Remove on; 404 → "No bezel for this console yet." + Remove off; 502 → "Could not read this bezel." + Try again → has-bezel; stale console response dropped (T40, T41). **Create:** 1920x1080 PNG → no warning, "Uploading..." disables controls, 201 → "Bezel saved for {label}.", input cleared, preview GET with `?v=` (T42); 1024x768 → amber warning, upload still sent (T47); 400/404/413/415/502/503/abort → `role="alert"` text, file kept (T43). **Update:** re-upload over has-bezel (image A → B) replaces it; preview reloads with B (T42). **Delete:** confirm accept → DELETE 204 → "Bezel removed for {label}." + empty; dismiss → 0 DELETE; 404/502/503 → alert, back to has-bezel (T44). 401/403 on POST/DELETE → existing session-expired panel (T45). | axe 0 violations in empty, has-bezel, read-error, file-selected, aspect-warning, upload-error (T48); checking captured with the GET held (T40); `target-size` ≥44px on select, file label, Upload, Remove, Try again; feedback `role="status"` / errors `role="alert"`; visible focus |

State mapping: the canonical vocabulary has one file per `<screen>.<state>.<viewport>.png`, so `default`, `error`, `submitted` and `filled` each cover several design states. Each capture records its design-state name (e.g. `booting`, `aspect-warning`) in `test.info().annotations` and the test title, as in SF01 QA01. `qa.viewports` defaults (1440x900, 768x1024, 375x812) are replaced on every row.

Coverage notes: update is covered by T42 (starts from has-bezel and checks the preview reloads with the new image); admin a11y by T48 (axe in 6 states); transient captures by T40 (GET held for `checking`), T42 (POST held for `uploading`) and T44 (`removing`). Remaining gap: the Bezels tab has no route of its own; screens.json uses `kind: "overlay"` (open recipe: `/admin` + click tab "Bezels"), which no catalog kind names exactly.

---

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Tasks |
|----|-------------|----------|--------------|-------|
| RF01 | Aba Bezels: console, envio PNG, prévia, remoção | YES | Frontend + Backend + E2E | 4, 8, 10 |
| RF02 | Chave `bezels/<id>.png`; novo envio substitui | YES | Backend | 1, 3, 4 |
| RF03 | `GET /api/bezel/<id>` pública, fora do matcher | YES | Backend | 4 |
| RF04 | Bezel atrás do jogo em `Wide`, área 16:9, janela com 100% da altura | YES | Frontend + E2E | 5, 6, 7, 9 |
| RF05 | Celular sem bezel e sem moldura, sem rolagem, Back home 44px, status some em running | YES | Frontend + E2E | 6, 7, 9 |
| RN01 | Só admin envia/remove; leitura sem login | YES | Backend + E2E | 4, 10 |
| RN02 | PNG por assinatura, até 2 MB, id da lista, nome ignorado | YES | Backend | 1, 4 |
| RN03 | Sem R2 ou falha → erro claro; nada em `public/` nem no MongoDB | YES | Backend | 2, 3, 4 |
| RN04 | Bezel nunca atrasa nem impede o jogo | YES | Frontend + E2E | 7, 9 |
| RN05 | 404 `no-store` vs 502 `no-store`; 200 `no-cache` + ETag; 304 | YES | Backend | 3, 4 |
| RN06 | Aviso de proporção no admin, envio permitido | YES | Frontend + E2E | 1, 8, 10 |
| Scope: QA-04, QA-08, QA-10, QA-11, QA-12, QA-13 | — | YES | Frontend + E2E | 6, 9 |
| Scope: QA-09 | — | YES | Frontend (layout sem moldura no celular) | 6, 9 |
| Scope: CR-1, CR-2, CR-3 | — | YES | Frontend | 5, 7 |
| Scope: inclusão do teste no gate | — | YES | Chore | 11 |
| Supersedes SF01 clauses (epic.md Notes, owner 2026-11-06) | SF01 RF03 no celular e no modo bezel (moldura removida); SF01 RF02 legenda (`pointer:fine` → só `Wide`); skeleton do design SF01 (sem proporção → 4/3); Layout stability SF01 (uma troca moldura → bezel permitida, só em booting); status running SF01 (`text-xs` "Running" → `sr-only` no celular) | YES | Frontend + E2E | 6, 7, 9 (T28 migra T05, T06, T07, T17 da SF01) |
| Arte de bezel, bezel por jogo, link de imagem | — | EXCLUDED | — | about.md Does NOT Include |
| QA-01, QA-02, QA-03, QA-05, QA-06, QA-07 | — | EXCLUDED | — | abertos só para `Wide` sem bezel (about.md) |
| Auditoria | — | EXCLUDED | — | 0001F-SF03 |
| Remoção da aba Cartridges | — | EXCLUDED | — | trabalho separado (dono, 2026-11-09) |

Coverage: 11/11 requisitos e 4/4 itens de escopo (100%).

## Overview
O admin não tinha onde pôr arte de bezel, e no celular a moldura CSS da SF01 gastava espaço do jogo. A SF04 cria a aba "Bezels" no admin. O PNG de cada console vai para o R2 e é servido por uma rota pública com revalidação por ETag.

A tela de jogo decide o modo pelo CSS. Em `Wide` com bezel, a imagem fica atrás do jogo numa área 16:9. Em `Wide` sem bezel, fica a moldura da SF01. No celular, o jogo aparece sem moldura. A imagem do bezel nunca entra na prontidão do jogo: se falha ou chega tarde, a moldura CSS fica.

## Main Flow
1. Admin → abre `/admin`, aba Bezels, escolhe o console → `GET /api/bezel/<id>` mostra a prévia ou "No bezel for this console yet."
2. Admin → escolhe um PNG → o navegador mede a proporção e avisa se não é 16:9 → `POST /api/admin/bezels/<id>` (multipart, campo `file`).
3. Rota admin → `requireAdmin` → id da lista → R2 configurado → tamanho → assinatura PNG → `putBezel` → 201.
4. Jogador → abre `/play/{slug}` em `Wide` → metadados 200 → `Emulator` e `PlayBezel` montam juntos.
5. `PlayBezel` → `GET /api/bezel/<id>` (no-cache + ETag) → carrega durante booting → `PlayStage` adota o modo bezel; senão fica a moldura.
6. Jogador no celular → `ThemedFrame` em modo `bare` → nenhum pedido de bezel.
7. Admin → Remove + `confirm()` → `DELETE /api/admin/bezels/<id>` → HeadObject → DeleteObject → 204.

## Implementation Order
`lib/bezel-console.ts` → `lib/r2.ts` (`createR2Client`) → `lib/bezel.ts` → `lib/bezel-routes.ts` + rotas + `tests/bezel.test.ts` → `Emulator` CR-3 + `useWideScreen` + `PlayBezel` + `tailwind.config.ts` → `ThemedFrame`, `StatusStrip`, `PlayTopBar`, `app/globals.css` → `PlayStage` → `BezelsTab` + `app/admin/page.tsx` → E2E da tela de jogo → E2E do admin → gate do AGENTS.md. Sem etapa de banco.

## Quick Reference

| pattern | search terms |
|---|---|
| Handler admin com guard | `app/api/admin/cartridges/route.ts`, `requireAdmin(` |
| Upload multipart | `app/api/admin/games/route.ts`, `request.formData()` |
| Leitura no R2 com headers | `app/api/rom/[slug]/route.ts`, `GetObjectCommand`, `transformToByteArray` |
| Leitor de sessão injetável | `lib/auth-guard.ts`, `SessionReader` |
| Aba admin cliente | `components/admin/CartridgesTab.tsx`, `getAdminAuthStatus` |
| Select de sistemas | `components/admin/GamesTab.tsx`, `systemOptions` |
| Palco e moldura da SF01 | `components/PlayStage.tsx`, `components/ThemedFrame.tsx`, `.play-frame-area` |
| Teste unitário node:test | `tests/auth-guard.test.ts`, `tests/play-theme.test.ts` |
| E2E com stub do emulador | `e2e/play-screen.qa.spec.ts`, `page.route('**/emulator.html*'` |
