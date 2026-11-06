# Discovery: 0002F Emulator Themes and Controls

## Related Features
See past-features.md. Summary: depends_on 0001F-SF01 (guard, done); soft depends_on 0001F-SF03 (audit, pending); conflicts with 0001F-SF04 (same game handlers and /api/rom, pending); shares the admin helper pattern from SF02.

## Prerequisites

| Requirement (from the user's request) | Prerequisite | Exists? | Evidence | Action |
|---|---|---|---|---|
| Visual models (themes) for the play screen | Theme data model | No | `models/game.ts:1-11` (Game has no theme field). `models/game.ts:22` `Room.theme: string` is a text label used by mock rooms (`lib/mock-data.ts:49,60`). A name collision risk. | Create. Use a distinct name such as `visualTheme` or `emulatorProfile`. |
| Pre-configured controls for all 12 systems | Control maps for 12 systems | Partial: 6 of 12 have explicit maps | See Existing Patterns, controls table | Create a data-driven map for all 12. |
| Fixed 600px iframe must adapt | Responsive frame | No | `components/Emulator.tsx:206` `height: '600px'` | Change the frame. |
| Phone virtual controller | Virtual gamepad | Unverified | `public/emulator.html` never sets `EJS_VirtualGamepadSettings` (grep). Whether stable supports it is UNVERIFIED. | Spike. |
| Admin: theme per console | Admin tab pattern | Yes | `app/admin/page.tsx:18,73-98`, `components/admin/GamesTab.tsx`, `CartridgesTab.tsx` | Add a third tab, reuse the pattern. |
| Admin: controls per console | Write endpoint | No | Only `/api/admin/games` and `/api/admin/cartridges` exist (app/api). | Create `/api/admin/...` handlers with requireAdmin. |
| Admin: theme per game (background, colors, frame) | Game field or collection | No | `models/game.ts:1-11` | Create. |
| Anonymous player reads the config | Public read endpoint | No | `/api/game/[id]` (`app/api/game/[id]/route.ts:4-17`) returns the whole Game with no projection. `/api/rom/[slug]` is anonymous (`app/api/rom/[slug]/route.ts:80-88`). | Create a public read route, or extend `/api/game`. |
| Works when MongoDB is down | Fallback defaults | Partial | `lib/data.ts:22-24` falls back to mock data. Admin writes in fallback go to `lib/admin-store.ts`, which the public read does NOT use (`lib/data.ts:26` uses `mockGames`). Admin-created games are invisible to `/api/game` when Mongo is down (verified by reading). | Code-defined defaults for 12 systems, and fix the store divergence. |
| Image uploads for backgrounds | Upload helper | Partial | `lib/r2.ts:117-150` `uploadRomToR2` (PutObjectCommand, R2 key `roms/...`). No image upload helper. No public base URL env var (`.env.example` lists only R2_ACCOUNT_ID, R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ROOMS_KEY). Public bucket access UNVERIFIED. | Decide URL input vs upload. |
| Admin guard | requireAdmin on new handlers | Yes | `lib/auth-guard.ts:62-79`, 10 handlers (see Related Features) | Reuse. |
| Branch from main | 0001F merged | No | Main is not an ancestor of HEAD (main fe282828, HEAD 858a02d6). epic.md:21-22 lists SF03 and SF04 pending. | Wait, per about.md. |

Rule: the prerequisites marked No must be in scope. Admin UI with no write endpoint, or a public read that fails without Mongo, is unusable.

## Files Mapping

```json
{"modify":["public/emulator.html","components/Emulator.tsx","app/play/[slug]/page.tsx","lib/emulator-cores.ts","models/game.ts","lib/data.ts","lib/admin-store.ts","app/admin/page.tsx","app/api/admin/games/route.ts","app/api/admin/games/[id]/route.ts","components/admin/GamesTab.tsx","app/api/game/[id]/route.ts"],"create":["components/admin/EmulatorProfilesTab.tsx","app/api/admin/emulator-profiles/route.ts","app/api/admin/emulator-profiles/[id]/route.ts","app/api/play-config/[slug]/route.ts","lib/emulator-profiles.ts","lib/emulator-profiles-store.ts","tests/emulator-profiles.test.ts"]}
```

| Path | Action | Reason |
|---|---|---|
| public/emulator.html | modify | EJS settings, control maps for 12 systems (lines 55-121), fix Master System and Game Gear scheme (line 74), read theme/control id from URL params |
| components/Emulator.tsx | modify | Frame height (line 206), sandbox decision, origin check on message handler (lines 169-170), read the play config |
| app/play/[slug]/page.tsx | modify | Fetch play config and render the themed frame; mobile layout |
| lib/emulator-cores.ts | modify | Single system to profile mapping (fallback and aliases are split across this file and Emulator.tsx:16-44) |
| models/game.ts | modify | Optional `themeId`/override field on Game; keep Room.theme separate |
| lib/data.ts | modify | Read the profile for a game in the read model |
| lib/admin-store.ts | modify | Include profile store, fix divergence with lib/data.ts |
| app/admin/page.tsx | modify | Third tab (lines 18, 73-98) |
| app/api/admin/games/route.ts | modify | Accept new game fields explicitly (no spread of body) |
| app/api/admin/games/[id]/route.ts | modify | Add new fields to the $set list (lines 61-75); this is the SF04 conflict zone |
| components/admin/GamesTab.tsx | modify | Form fields for theme per game (form state lines 28-36, submit 75-119) |
| app/api/game/[id]/route.ts | modify or keep | Decide whether the profile is merged here or served by a separate route |
| components/admin/EmulatorProfilesTab.tsx | create | Admin editor for theme and controls per console |
| app/api/admin/emulator-profiles/route.ts, [id]/route.ts | create | requireAdmin CRUD |
| app/api/play-config/[slug]/route.ts | create | Anonymous, no-Mongo-safe read of the resolved config |
| lib/emulator-profiles.ts | create | Code-defined defaults for 12 systems (used when Mongo is down), pure |
| lib/emulator-profiles-store.ts | create | Mongo collection plus in-memory store |
| tests/emulator-profiles.test.ts | create | node:test unit tests (package.json "test" glob picks up tests/*.test.ts) |

## Existing Patterns

Controls: `public/emulator.html` explicit maps versus fallback (verified):

| System (lib/emulator-cores.ts:31-42) | core | emulator.html branch | Explicit map | controlScheme |
|---|---|---|---|---|
| NES | fceumm | nes branch :92-106 | Yes | nes (:106) |
| SNES | snes9x | default :107-121 | No (fallback) | none |
| Nintendo 64 | mupen64plus_next | default | No | none |
| Game Boy | gambatte | default | No | none |
| Game Boy Color | gambatte | default | No | none |
| Game Boy Advance | mgba | default | No | none |
| Master System | genesis_plus_gx | genesis branch :55-75 | Yes, but scheme WRONG | segaMD (:74). The segaMS branch at :71 is unreachable from the mapping. |
| Mega Drive / Genesis | genesis_plus_gx | genesis branch | Yes | segaMD (:74) |
| Game Gear | genesis_plus_gx | genesis branch | Yes, scheme WRONG (same as MS) | segaMD |
| PlayStation | pcsx_rearmed | default | No | none |
| Arcade (FBNeo) | fbneo | arcade branch :76-91 | Yes | arcade (:91) |
| Neo Geo | fbneo | arcade branch | Yes | arcade |

Totals: 6 explicit (NES, MD, MS, GG, Arcade, Neo Geo), 6 fallback (SNES, N64, GB, GBC, GBA, PS). The default map (:110-120) is the NES layout (x=BUTTON_2, z=BUTTON_1, Enter=START, arrows).

Core fallback: `components/Emulator.tsx:16-44` (`getCoreCandidates`) is a second alias table, separate from `lib/emulator-cores.ts`. Candidates: genesis_plus_gx `[genesis_plus_gx]` (:19); fceumm `[fceumm,nestopia]` (:22); snes9x (:25); gambatte (:27); mgba `[mgba,gba]` (:30); fbneo `[fbneo,mame2003_plus,mame2003]` (:31); mupen64plus_next (:38); pcsx_rearmed (:36). Each attempt has a 10s timeout (`FALLBACK_TIMEOUT_MS`, :11, :140-158) and a 250ms delay (:12, :125). Worst case for fbneo is about 30s.

Iframe: `components/Emulator.tsx:199-211` fixed `height: '600px'` (:206), `width: '100%'`, `allow="fullscreen"` (:211), `key={iframeUrl}` (:202), NO sandbox attribute. The iframe is same-origin (`src=/emulator.html?...`, :128-135).

Message channel: `public/emulator.html:182` posts `{type:'EMULATOR_CANVAS_READY'}` with target `'*'`. `components/Emulator.tsx:169-182` accepts it without origin or source check.

emulator.html inputs: URL params `title` (:31), `core` default `nes` (:32), `rom` (:33). The ROM is fetched with `fetch(romUrl)` (:204) with no try/catch around the fetch (the `response.ok` check is at :205). The loader comes from `EMULATORJS_CDN + 'loader.js'` (:246), with CDN `https://cdn.emulatorjs.org/stable/data/` (:36). No SRI, no version pin beyond `stable`.

EJS settings set in emulator.html (verified): EJS_player (:38), EJS_core (:39), EJS_pathtodata (:40), EJS_startOnLoaded (:41), EJS_DEBUG_XX (:44), EJS_defaultControls (:45, :58, :79, :95, :110), EJS_controlScheme (:72, :74, :91, :106), EJS_defaultOptions.keyboardInput and altKeyboardInput = 'disabled' (:129-131), EJS_ready (:136), EJS_gameUrl (:223), EJS_gameData (:224), EJS_gameName (:243).
NOT set anywhere in the repo (grep verified): EJS_color, EJS_backgroundImage, EJS_backgroundColor, EJS_VirtualGamepadSettings, EJS_Buttons, and any EJS_controlScheme for the default branch.

Page: `app/play/[slug]/page.tsx` is `'use client'` (:1), fetches `/api/game/${slug}` (:21), renders the title (:43) and system (:44), and mounts `<Emulator>` with the core from `getCoreForSystem` (:54-55). Container is `max-w-5xl px-6 py-16` (:40). No mobile-specific code, no fullscreen control, no orientation handling.

Admin: `app/admin/page.tsx` has tabs as `useState('games'|'cartridges')` (:18), tab buttons (:73-94), and `onAuthError` plumbing (:19, :58-70, :97-98). Auth errors replace the tabs with Portuguese copy (:10-13). `components/admin/GamesTab.tsx`: loadGames with getAdminAuthStatus (:42-59), multipart submit with boolean-to-'true'/'false' conversion (:75-119, :84-89), edit populates form (:245-256), Testar opens /play (:263-282), Link copies it (:284-309). No image input exists in the form (:161-199), although `image` is in state (:33).

Store: `lib/mongo.ts:11-41` singleton client, DB name `MONGODB_DB` default `retrokey` (:40). `lib/data.ts:15-38` getGames merges mockGames and Mongo `games` by slug, DB wins (:26-33). `lib/data.ts:54-64` getGameBySlug matches slug then title. `lib/admin-store.ts:5-6` in-memory copies of mock data.

R2: `lib/r2.ts:117-150` uploadRomToR2 (PutObjectCommand, key from `buildRomObjectKey` :34-51), with local fallback `saveRomFileLocally` (:105-115, writes `public/roms`).

Layout: `app/layout.tsx:5-42` inline devtools guard script, injected at :53. `app/globals.css:5-9` dark color-scheme only.

## Reusable Functionality
- `requireAdmin` and `evaluateAdminSession` (`lib/auth-guard.ts:24-79`).
- `getAdminAuthStatus` and `ADMIN_LOGIN_URL` (`lib/admin-api.ts:9-18`).
- `systemOptions`, `systemToCoreMap`, `getCoreForSystem` (`lib/emulator-cores.ts:15-122`). Used by GamesTab.tsx:5,178 and PlayPage.tsx:6,54.
- `getDb` and `getMongoClient` (`lib/mongo.ts:11-41`).
- Mongo-or-memory fallback pattern in `app/api/admin/games/route.ts:12-19,43-79`.
- `uploadRomToR2` and `buildRomObjectKey` (`lib/r2.ts:34-51,117-150`), reusable for theme images with a different prefix.
- `getGameBySlug` (`lib/data.ts:54-64`).
- Test pattern: `tests/*.test.ts` with node:test (`tests/admin-api.test.ts`, `tests/rooms-data.test.ts`). `package.json` test script: `node --import tsx --test "tests/*.test.ts"`.

## Integration Points
- Play page to Emulator: props `{gameSlug, gameTitle, core}` (`components/Emulator.tsx:5-9`). A theme would be an added prop or a fetch in the page.
- Emulator to emulator.html: URL params only (`components/Emulator.tsx:128-134`). Any theme or control id must travel as a param or be fetched by emulator.html from an allowlisted route.
- Emulator to parent: postMessage, one message type only.
- Admin tabs to API: `fetch('/api/admin/...')` with the `onAuthError` callback.
- Public read: `/api/game/[id]` (`app/api/game/[id]/route.ts`) and `/api/rom/[slug]` (anonymous, must stay so).
- ROM delivery: `/api/rom/[slug]` only serves `active` games (`app/api/rom/[slug]/route.ts:84`).
- Middleware: `middleware.ts:19` matcher `/admin/:path*`. It does not cover `/api/*`.

## Technology Decisions Pre-decided by the Codebase
- Next.js 14.2.15 App Router, route handlers, no service layer, no validation library, raw mongodb v7, no ORM (package.json).
- NextAuth v5 beta credentials, JWT session (`auth.config.ts:18`).
- Tailwind 3.4 utility classes; no UI library (`app/globals.css`, `package.json`).
- Cloudflare R2 through @aws-sdk/client-s3 (`lib/r2.ts:1`).
- EmulatorJS loaded from cdn.emulatorjs.org `stable` (`public/emulator.html:36`). Pinning a version would be a new decision.
- Node 24.x per package.json engines.

## Open Decisions for the Spec

| Decision | Options | Recommendation |
|---|---|---|
| Where config lives | (a) fields on Game (b) new collection keyed by system (c) both | (c): new `emulator_profiles` collection keyed by system for console theme and controls; optional `visualTheme` override on Game. |
| Public read shape | (a) extend `/api/game/[id]` response (b) new `/api/play-config/[slug]` | (b): one anonymous route that returns the resolved config (game override, else console profile, else code default). |
| No-Mongo fallback | (a) mock-only (b) code defaults in `lib/emulator-profiles.ts` | (b): code defaults for all 12 systems, so the play screen works with no DB. |
| Store divergence | (a) leave (b) make `lib/data.ts` read `adminGames` in fallback | (b). Required before admin-created data can show up when Mongo is down. |
| Theme representation | (a) free CSS/HTML (b) preset ids plus validated tokens (hex color regex, bounded numbers, https image URL from allowlist) | (b). No raw CSS or HTML is ever sent to the iframe. |
| Where the frame and background render | (a) inside emulator.html via EJS_color/EJS_backgroundImage (b) in the parent React frame around the iframe | (b) for frame and background. Keep emulator.html for controls only. |
| Control maps | (a) keep hard-coded in emulator.html (b) data-driven: control preset id passed as URL param, maps defined in `lib/emulator-profiles.ts` and mirrored in emulator.html | (b) with a single source of truth. Fix Master System and Game Gear scheme (`segaMS`). |
| Mobile virtual controller | (a) EmulatorJS built-in via EJS_VirtualGamepadSettings (UNVERIFIED on stable) (b) React overlay posting input to iframe (needs EmulatorJS input API, UNVERIFIED) (c) native touch only | Spike (a) first. If it fails, (b). |
| Iframe sandbox | (a) none, as now (b) sandbox attribute (c) move emulator.html to a separate origin | (a) for now with strict input validation. A sandbox probably breaks EmulatorJS (unverified). |
| Image source | (a) https URL with host allowlist (b) R2 upload via a new helper with a `themes/` prefix | (a) for MVP (no public base URL exists in env). (b) later if needed. Never use the local `public/` fallback for theme images on Vercel. |
| Audit | (a) wait for SF03 (b) write now with no audit | (a) or record an explicit exclusion in about.md. |
| Branch base | (a) branch from HEAD 0001F (b) branch from main after merge | (b), per about.md. |
| Room.theme name | keep / rename | Keep Room.theme; name the new field `visualTheme`. |
| Game admin write of `active` | see Risks | Fix in the same change, since the new fields pass through the same handlers. |

## Risks / Edge Cases
- Stored XSS on the app origin. `components/Emulator.tsx:200-211` has no sandbox, and emulator.html is same-origin. Any admin-controlled string that reaches emulator.html as HTML or CSS runs with the app origin. Mitigate by allowlisting values, never by string interpolation. The `title` param is currently used only as text (emulator.html:243, 31).
- postMessage. `public/emulator.html:182` target `'*'`, `components/Emulator.tsx:169-170` no origin check. `docs/code-quality-review.md:77` already flags it. Any new message must check `event.origin` and `event.source === iframe.contentWindow`.
- Third-party script executes same-origin. `public/emulator.html:246` loads `cdn.emulatorjs.org/stable/loader.js` with no SRI and no pinned version.
- No CSP. No `next.config.*` in repo, no headers in `vercel.json`, no CSP in `middleware.ts`. The inline devtools guard (`app/layout.tsx:53`) would need a hash or nonce if a CSP is added.
- `/api/game/[id]` returns the full Game document with no projection (`app/api/game/[id]/route.ts:13`). Anything stored on Game is public.
- In-memory divergence. `lib/data.ts:26` uses `mockGames` only, and admin fallback writes to `lib/admin-store.ts`. Admin-created games do not appear in `/api/game` without Mongo.
- `active` string bug. `components/admin/GamesTab.tsx:84-89` sends `'true'`/`'false'`. `app/api/admin/games/route.ts:32,60` and `games/[id]/route.ts:43,72` store the raw FormData value. The string `"false"` is truthy, so `!game.active` (`app/api/rom/[slug]/route.ts:84`) and `item.active` (`lib/data.ts:75`) would treat it as active. Not checked against a live DB.
- `$set` with undefined. `games/[id]/route.ts:61-75` writes every listed field, including fields the client omitted (JSON path). Driver v7 `ignoreUndefined` default UNVERIFIED.
- Mobile. Fixed 600px frame (`Emulator.tsx:206`); no `h-dvh` or aspect ratio; `allow="fullscreen"` only; no orientation lock; page padding `px-6 py-16` (`play/[slug]/page.tsx:40`). Keyboard input is disabled (`emulator.html:130-131`). Behavior on phones UNVERIFIED.
- Fallback time. Up to 10s per candidate (`Emulator.tsx:11,140`); fbneo has 3 candidates, about 30s before failure.
- ROM fetch in emulator.html has no try/catch (`public/emulator.html:204`).
- SF04 and this feature both change `/api/rom` and the game handlers. Merge order matters.
- Vercel filesystem. `uploadRomToR2` writes `public/roms` on R2 failure (`lib/r2.ts:145-148`). Do not use the same fallback for theme images.
- CSRF on admin JSON writes. No CSRF token in the admin forms. Cookie SameSite default UNVERIFIED.

## Wiki vs Code Contradictions

| Wiki claim (file) | Code now | Evidence |
|---|---|---|
| "Admin API routes are not protected server-side", "middleware.ts has matcher: [] so it never runs" (domains/backend.md, domains/frontend.md) | Wrong. matcher is `['/admin/:path*']`, and all 10 admin handlers call requireAdmin | `middleware.ts:19`; grep requireAdmin in app/api/admin (10 hits) |
| "/admin is checked only in the browser" (index.md, backend.md) | Partly stale. middleware redirects `/admin` when no session | `middleware.ts:7-12` |
| Auth code cites `auth.ts:15`, `auth.ts:31`, `auth.ts:40-51` (backend.md) | Stale. auth.ts delegates `authorize` to `lib/admin-login.ts`; config in `auth.config.ts` | `auth.ts:1-21`, `auth.config.ts` |
| Default admin credentials active when env is unset (backend.md, conventions.md) | Changed. Defaults only in development/test; production fails closed | `lib/auth-config.ts`; 0001F SF02 |
| Node `20.x` (index.md, backend.md) | Stale. engines is 24.x | `package.json` engines |
| `.env` and `cookies.txt` not covered by .gitignore (conventions.md) | Now covered by .gitignore | `.gitignore` |
| Emulator `getCoreCandidates` at :16-44, iframe at :128-135, ready signal at :169-182 (frontend.md) | Still accurate | verified |
| Test gate lists 3 tests (AGENTS.md validation_gates) | package.json test script globs all `tests/*.test.ts` | `package.json` scripts.test |
| "Admin route handlers call lib/mongo.ts directly" (conventions.md) | Still accurate | `app/api/admin/*` imports `@/lib/mongo` |

## Metadata
{"updated":"2026-11-06","feature":"0002F-emulator-themes-controls","by":"discovery-agent","gitnexus":{"repo":"Portifolio","emulator_incoming":"UNKNOWN (JSX usage not indexed; grep confirms app/play/[slug]/page.tsx:5,55)","getCoreForSystem":"LOW, 1 direct caller PlayPage"},"unverified":["EmulatorJS EJS_color, EJS_backgroundImage, EJS_backgroundColor, EJS_VirtualGamepadSettings, EJS_Buttons, EJS_defaultControls value shapes, touch gamepad on mobile","stable CDN version pin","R2 public bucket access","undefined in Mongo $set","SameSite cookie default","Vercel fs persistence"]}
