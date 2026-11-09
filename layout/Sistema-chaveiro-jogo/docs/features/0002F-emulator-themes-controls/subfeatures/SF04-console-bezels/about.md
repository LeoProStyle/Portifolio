---
id: 0002F-SF04
type: feature
slug: console-bezels
status: pending
branch: feature/0002F-emulator-themes-controls
created: 2026-11-06
updated: 2026-11-09
related: [0002F, 0002F-SF01, 0002F-SF03, 0001F-SF03]
tags: [emulator, ui, mobile, bezel, admin, storage]
intent: none
---

# SF04 — Console Bezels

## TL;DR
Subfeature de 0002F que deixa o admin subir uma imagem de bezel (arte PNG 16:9 com o centro transparente) para cada um dos 12 consoles, numa aba própria "Bezels" do admin. A imagem fica no R2, sem MongoDB, e aparece atrás do jogo em telas largas com mouse. No celular o jogo passa a ocupar a tela, sem bezel e sem a moldura CSS da SF01.

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

**Serves the feature objective by:** deixar o admin pôr a arte de cada console em volta do jogo e dar ao celular a tela inteira para o jogo.

## Problem
A tela de jogo não tem como mostrar arte de bezel, e no celular a moldura gasta espaço.
- **Afetados:** o dono, que quer usar arte de bezel própria; jogadores no celular.
- **Sem bezel em imagem:** a tela de jogo não lê nenhuma imagem; `PlayTheme.bgImage` é só validado (`lib/play-theme.ts`). Um link colado pelo dono não aparece.
- **Celular:** a moldura e o fundo ocupam espaço que o jogo poderia usar (390x844: quadro de ~270px de altura, review-001 QA-09).
- **Contorno atual:** nenhum.

## Users

| role | goal | pain |
|---|---|---|
| Admin (dono do RetroKey) | Subir a arte de bezel de cada console sem mexer em código | Não existe campo nem armazenamento para isso |
| Jogador no PC | Ver o jogo dentro da arte do console | Só há moldura CSS genérica |
| Jogador no celular | Jogo grande, sem enfeite em volta | Moldura e fundo roubam espaço |

## Requirements
- **RF01:** Uma aba nova "Bezels" no admin (terceira aba de `/admin`, ao lado de Games e Cartridges) mostra o bloco "Bezel por console". Ele deixa escolher um dos 12 consoles, enviar um arquivo PNG, ver a prévia do bezel atual (lida da rota pública) e remover o bezel. A aba Cartridges não muda.
- **RF02:** O bezel enviado fica no R2 com a chave `bezels/<id>.png`, onde `<id>` é o id curto do console: `nes`, `snes`, `n64`, `dmg`, `gbc`, `gba`, `sms`, `megadrive`, `gamegear`, `ps`, `arcade`, `neogeo` (os ids de moldura de `lib/play-theme.ts`). Um novo envio substitui o anterior.
- **RF03:** A rota pública `GET /api/bezel/<id>` (arquivo `app/api/bezel/[console]/route.ts`, fora de `app/api/admin/**`) devolve o bezel sem login. Ela fica fora do `matcher` de `middleware.ts` (`/admin/:path*`), que não é alterado.
- **RF04:** Quando a condição `(min-width: 1024px) and (pointer: fine)` é verdadeira e o console tem bezel, a tela de jogo mostra o bezel atrás do jogo numa área 16:9. A área 16:9 é o maior retângulo 16:9 que cabe no palco abaixo da barra de topo (sem contar a faixa de status e a linha da legenda), centralizado. A janela do jogo é o maior retângulo na proporção do console com **100% da altura da área 16:9**, centralizado na horizontal. Em 1920x1080 o buraco transparente da arte é 1440x1080 (4/3), 1200x1080 (10/9) ou 1620x1080 (3/2). Sem bezel, fica a moldura CSS da SF01.
- **RF05:** Quando a condição de RF04 é falsa (celular, retrato ou paisagem), não há bezel nem moldura CSS: o jogo ocupa a maior área possível na proporção do console, sem rolagem da página. A barra mantém Back home com alvo de 44px. O texto de status some quando o `Emulator` reporta `running` (`onStatusChange`, evento `EMULATOR_CANVAS_READY`) e volta nos estados de erro.
- **RN01:** Só admin envia ou remove bezel (`requireAdmin`); ver o bezel não exige login.
- **RN02:** O servidor aceita só arquivo com assinatura PNG nos bytes (`89 50 4E 47 0D 0A 1A 0A`), de até 2 MB, para um `<id>` da lista fechada; o nome do arquivo enviado nunca vira chave. O servidor não confere transparência.
- **RN03:** Sem R2 configurado, ou com falha do R2, o envio e a remoção falham com mensagem clara; nada é gravado em `public/` nem no MongoDB.
- **RN04:** O bezel nunca atrasa nem impede o jogo: falha, 404 ou demora na imagem só deixam a tela sem bezel; a tela de jogo funciona sem MongoDB e sem R2.
- **RN05:** A leitura distingue bezel ausente (404, `Cache-Control: no-store`) de falha do R2 (502, `no-store`). O bezel existente vai com `Cache-Control: no-cache` e `ETag`, então um envio novo aparece na próxima abertura do jogo (a rota de ROM usa `max-age=86400`; a de bezel não).
- **RN06:** O admin mede a imagem escolhida no navegador (largura e altura naturais) antes de enviar; se `|largura/altura − 16/9| > 0.02`, mostra um aviso e ainda permite o envio.

### HTTP contract

| Method | Path | Request | Success | Failures |
|---|---|---|---|---|
| POST | `/api/admin/bezels/<id>` | `multipart/form-data`, campo `file` (PNG) | 201, JSON `{ console, key }` | 401 sem sessão, 403 sessão sem papel admin (`requireAdmin`); 404 `<id>` fora da lista; 400 sem arquivo; 415 não é PNG; 413 acima de 2 MB; 503 R2 não configurado; 502 falha do R2 |
| DELETE | `/api/admin/bezels/<id>` | — | 204 | 401 sem sessão, 403 sessão sem papel admin; 404 `<id>` fora da lista ou sem bezel; 503 R2 não configurado; 502 falha do R2 |
| GET | `/api/bezel/<id>` | — | 200 `image/png`, `Cache-Control: no-cache`, `ETag`; 304 quando `If-None-Match` é igual ao `ETag` atual | 404 corpo fixo, `no-store` (sem bezel, `<id>` fora da lista ou R2 não configurado); 502 `no-store` (falha do R2) |

### Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Bezel por console, enviado pelo admin, sem arte embutida | As imagens são de responsabilidade do dono | Arte de bezel no repositório — direito de uso é do dono decidir |
| Aba própria "Bezels" no admin (decisão do dono, 2026-11-09, no `/add-plan`) | Bezel é do console; a aba Cartridges só cuida do vínculo tag NFC → jogo e o dono não a usa (grava o link do jogo direto na tag) | Bloco dentro da aba Cartridges — mistura dois assuntos; campo dentro de "Create new cartridge" — criar cartucho trocaria o bezel do console |
| Remoção da aba Cartridges fica fora da SF04 (decisão do dono, 2026-11-09) | A remoção toca as rotas `app/api/admin/cartridges/**`, o fluxo `/nfc/[id]` e o E2E do admin, que esta SF não muda | Remover junto na SF04 — quebra a restrição "rotas admin existentes não mudam" |
| Chave fixa no R2 como registro, sem MongoDB | Funciona sem banco; a existência do arquivo é o dado | Coleção no MongoDB — exige o 0001F inteiro e a 0002F-SF03 |
| Duas rotas novas: `app/api/admin/bezels/[console]` (POST, DELETE, `requireAdmin`) e `app/api/bezel/[console]` (GET público); rotas admin existentes intactas | O dono aprovou as duas; a leitura pública fica fora do prefixo admin | GET público dentro da rota admin — mistura acesso livre e protegido no mesmo arquivo |
| Leitura por rota que lê o R2 | Não depende de bucket público nem de URL pública do R2 | Link público do R2 — não há URL pública configurada |
| Não reusar `uploadRomToR2` | Ela grava em `public/roms` quando o R2 falha (`lib/r2.ts:118-119, 148`) | Reusar — falha silenciosa e arquivo perdido no Vercel |
| Bezel só com `(min-width: 1024px) and (pointer: fine)` | `pointer:fine` sozinho pega 844x390, viewport de celular no E2E | Só `pointer:fine` |
| Janela do jogo com 100% da altura do 16:9, centralizada (decisão do dono) | Padrão dos bezels RetroArch / The Bezel Project; o dono desenha o buraco por essa regra | 90% da altura; percentual por console guardado no R2 |
| Sem auditoria nesta SF | 0001F-SF03 (admin-audit-trail) ainda pendente | Esperar o 0001F inteiro — o dono quer agora |
| Achados abertos do review-001 que não são de moldura CSS entram na SF04 (aceito pelo dono na confirmação desta spec, 2026-11-06) | Estão nos mesmos arquivos que a SF04 reescreve (`PlayStage`, `ThemedFrame`, `StatusStrip`, `PlayTopBar`, E2E da tela de jogo); corrigir junto evita uma segunda rodada nos mesmos componentes | Deixar para uma rodada própria de correção — reabre os mesmos arquivos logo depois |

## Scope
### Includes
- Aba "Bezels" no admin com upload, prévia e remoção.
- Rota admin de envio e remoção e rota pública de leitura do bezel, com R2.
- Validação do arquivo no servidor (assinatura PNG, 2 MB, console da lista) e aviso de proporção no admin.
- Camada de bezel na tela de jogo para telas largas e layout sem moldura no celular.
- Achados abertos do review-001 nos mesmos arquivos, cada um ligado a uma parte do objetivo:
  - QA-04 — botões Retry/Reload com `px-5` fora da escala de espaçamento; tela bem acabada no PC.
  - QA-08 — painel not-found sem ação principal visível; jogador sai da tela de erro.
  - QA-09 — contrato sem posição vertical do quadro no retrato; resolvido pelo layout de celular sem moldura (RF05).
  - QA-10 — título em 844x390 abaixo da escala declarada; barra mínima do celular (RF05).
  - QA-11 — estado loading-metadata sem checagem axe; acessibilidade da tela de jogo.
  - QA-12 — título longo truncado no retrato; barra mínima do celular.
  - QA-13 — skeleton de tela cheia que salta para o quadro; transição de carregamento.
  - CR-1 — ternário com ramo inalcançável em `PlayStage`; código da tela que esta SF muda.
  - CR-2 — `getCoreForSystem('')` loga aviso enquanto os metadados carregam; mesmo arquivo.
  - CR-3 — união de status repetida em vez de `EmulatorStatus`; mesmo arquivo.

### Does NOT Include
- Arte de bezel pronta — as imagens são do dono.
- Bezel por jogo — só por console, pedido do dono.
- Link de imagem colado (lista `ALLOWED_IMAGE_HOSTS`) — o envio de arquivo substitui o link de fundo previsto na 0002F-SF03.
- QA-01, QA-02, QA-03, QA-05, QA-06, QA-07 (visual das molduras CSS) — continuam abertos só para PC sem bezel; no celular a moldura CSS sai.
- Auditoria das alterações — fica com o 0001F-SF03.
- Tela cheia real e controle virtual — 0002F-SF02.
- Mudar as rotas admin existentes, `lib/mongo.ts`, login ou `middleware.ts`.
- Remover a aba Cartridges, suas rotas e o fluxo `/nfc/[id]` — trabalho separado, pedido pelo dono em 2026-11-09.

## Success Metrics

| metric | target | source |
|---|---|---|
| Envio aceita PNG válido de até 2 MB e recusa não-PNG (415), acima de 2 MB (413), `<id>` fora da lista (404), sem arquivo (400) | 100% dos casos | testes das rotas com cliente R2 falso injetado |
| Envio e remoção sem sessão / com sessão sem papel admin | 401 / 403 | testes das rotas |
| Sem R2 configurado: envio 503; leitura 404 | sim | testes das rotas |
| Leitura: 200 `image/png` com `ETag`; 304 com `If-None-Match` igual; sem bezel 404 `no-store`; falha do R2 502 | sim | testes da rota pública com cliente R2 falso |
| QA-04: botões Retry/Reload só com passos de espaçamento declarados | sim | estilo computado no QA |
| QA-08: painel not-found mostra uma ação principal visível | sim | E2E |
| QA-10 / QA-12: título da barra do celular legível e dentro da escala declarada | sim | estilo computado no QA |
| QA-11: axe sem violações no estado loading-metadata | 0 | E2E com axe |
| QA-13: carregamento sem salto grande entre skeleton e quadro | caixa do skeleton na proporção do console | E2E (caixa medida) |
| CR-1 / CR-2 / CR-3: sem ramo inalcançável, sem aviso `No system selected` enquanto os metadados carregam, status com o tipo `EmulatorStatus` | sim | revisão de código e console do E2E |
| Bezel visível atrás do jogo em 1366x768, janela do jogo com 100% da altura da área 16:9 e centralizada | sim | E2E com `page.route` servindo um PNG em `/api/bezel/**` |
| Bezel 404, 500 ou com 3 s de atraso: jogo inicia normalmente, sem bezel | sim | E2E com `page.route` |
| Celular (390x844 e 844x390): sem bezel, sem `[data-frame]`, sem rolagem, jogo na proporção, Back home 44px | sim | E2E |
| Aba Bezels do admin: prévia, envio e remoção | sim | E2E com `page.route` nas rotas `/api/admin/bezels/**` e `/api/bezel/**` |
| Gravação no R2 de produção durante testes | 0 — o cliente R2 dos testes de servidor é sempre o falso injetado, e o E2E só usa `page.route` | testes e E2E |

## Relations
- part_of [[0002F]]
- depends_on [[0002F-SF01]] — usa o palco, o `ThemedFrame` e os temas da SF01

## Observations
- [constraint] o bucket R2 é compartilhado com `roms/` e `rooms.json`; o prefixo `bezels/` não colide (`lib/r2.ts:30-32, 50`) #storage
- [risk] `getR2BucketName` e `getR2Endpoint` têm impacto HIGH no GitNexus (10 callers); a SF04 só usa, não altera #storage
- [risk] limite de corpo de requisição do Vercel (~4.5 MB) não verificado; o limite de 2 MB fica abaixo dele #admin
- [constraint] o upload roda no servidor, então o E2E não intercepta o R2; a leitura e as chamadas do admin partem do navegador e são interceptáveis com `page.route` #test
- [impact] o celular perde a moldura CSS da SF01 #ui
- [constraint] envio de admin sem registro de auditoria até o 0001F-SF03 #security

## References
- {{doc:0002F}}
- {{doc:0002F-SF01}}
- {{doc:0002F-SF03}}
- {{doc:0001F-SF03}}
- `docs/features/0002F-emulator-themes-controls/discovery.md` (seção SF04 console-bezels)
- `docs/features/0002F-emulator-themes-controls/review-001.md`
