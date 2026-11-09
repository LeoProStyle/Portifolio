# Tasks: 0002F-emulator-themes-controls — SF04 console-bezels

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 11 |
| Services | test, backend, frontend, infra |

## Requirements Coverage

- [x] RF01 — Admin tab "Bezels" (third tab of `/admin`): choose one of 12 consoles, upload PNG, preview current bezel, remove it; Cartridges tab unchanged
- [x] RF02 — Bezel stored in R2 under `bezels/<id>.png` (12 frame ids); a new upload replaces the old one
- [x] RF03 — Public `GET /api/bezel/<id>` (`app/api/bezel/[console]/route.ts`), no login, outside the `middleware.ts` matcher
- [x] RF04 — With `(min-width: 1024px) and (pointer: fine)` and a bezel, bezel drawn behind the game in a 16:9 area; game window takes 100% of its height, centred; no bezel keeps the SF01 CSS frame
- [x] RF05 — Outside Wide: no bezel, no CSS frame, largest console-ratio window, no page scroll, Back home 44px, status text hidden while running and shown on errors
- [x] RN01 — Only admin uploads or removes (`requireAdmin`); reading needs no login
- [x] RN02 — Server accepts only PNG signature bytes, ≤ 2 MB, id from the closed list; uploaded filename never becomes a key
- [x] RN03 — No R2 or R2 failure → clear error; nothing written to `public/` or MongoDB
- [x] RN04 — Bezel never delays or blocks the game; play screen works without MongoDB and without R2
- [x] RN05 — Read: 404 `no-store` missing vs 502 `no-store` R2 failure; 200 `no-cache` + `ETag`; 304 on matching `If-None-Match`
- [x] RN06 — Admin measures the chosen image; warns when `|w/h − 16/9| > 0.02`, still allows the upload

## TDD

- [x] T-TEST-01 Contract tests T01, T21, T22 (RF02, RN06): 12 ids and `bezels/<id>.png` keys, aspect tolerance in/out — `tests/bezel.test.ts`
- [x] T-TEST-02 Contract tests T02–T20 (RF01, RF02, RF03, RN01, RN02, RN03, RN05): handler factories with injected fake `BezelR2Client` and `readSession`; 201/204/304/400/401/403/404/413/415/502/503, headers, ETag, no `public/bezels` — `tests/bezel.test.ts`
- [x] T-TEST-03 Contract tests T23–T38 (RF04, RF05, RN04, QA-04, QA-08, QA-09, QA-10, QA-11, QA-12, QA-13, CR-2) plus SF01 T05/T06/T07/T17 migration (T28), `routeBezel` on every Wide test — `e2e/play-screen.qa.spec.ts`
- [x] T-TEST-04 Contract tests T39–T45, T47, T48 (RF01, RF02, RN01, RN06): Bezels tab placement, preview states, stale response, upload, errors, remove, auth panel, aspect warning, axe — `e2e/admin.qa.spec.ts`

## Execution

- [x] T01 Write bezel unit and route-factory contract tests T01–T22
  - Service: test
  - Files: `tests/bezel.test.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: in a shell without any `R2_*` variable, `node --import tsx --test tests/bezel.test.ts` exits non-zero only because `lib/bezel-console.ts`, `lib/bezel.ts` and `lib/bezel-routes.ts` do not exist yet. Rules for the file: fake `BezelR2Client` records every command and is scripted per case; `readSession` injected; never sets `R2_*` env; never imports a route file; each module group (bezel-console, bezel, bezel-routes) loads its module with `await import()` inside its own `describe`, so a missing module fails only its own group and later tasks can run their group with `--test-name-pattern`
- [x] T02 Write play-screen and admin E2E for SF04 (red)
  - Service: test
  - Files: `e2e/play-screen.qa.spec.ts`, `e2e/admin.qa.spec.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: with `.next` deleted, ports 3001/3002 free and `MONGODB_DB=retrokey_e2e`, `npx playwright test e2e/play-screen.qa.spec.ts e2e/admin.qa.spec.ts --project=main` fails on the missing `[data-window]` element and the missing "Bezels" tab button. Spec rules: new helper `routeBezel(page, 'missing'|'png'|'error'|'slow')` called by every Wide test (1280x720 default, 1366x768, 1920x1080, migrated SF01 tests included); bezel data only through `page.route` on `/api/bezel/**` and `/api/admin/bezels/**`; held-ready `/emulator.html` stub posts `EMULATOR_CANVAS_READY` only when released; titles carry the `SF04-` prefix; `[data-frame]` locators in `openRunning`/`frameRatio` move to `[data-window]`; T17 Back home checked inside the panel; admin T03 "all 10 admin routes" count unchanged; no T46
- [x] T03 Create pure bezel-console module: ids, key, PNG, aspect
  - Service: backend
  - Files: `lib/bezel-console.ts`
  - Deps: T01
  - Consumes: -
  - Produces: `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>`, `BEZEL_CONSOLE_IDS: readonly BezelConsoleId[]`, `isBezelConsoleId(value: unknown): value is BezelConsoleId`, `bezelObjectKey(id: BezelConsoleId): string`, `BEZEL_MAX_BYTES = 2097152`, `BEZEL_MAX_REQUEST_BYTES = BEZEL_MAX_BYTES + 65536`, `PNG_SIGNATURE: readonly number[]`, `hasPngSignature(bytes: Uint8Array): boolean`, `BEZEL_ASPECT_TOLERANCE = 0.02`, `isBezelAspectOff(width: number, height: number): boolean`
  - Verify: `node --import tsx --test --test-name-pattern="RF02-key-per-console-id|RN06-aspect" tests/bezel.test.ts` exits 0 (T01, T21, T22) in a shell without `R2_*`; the module imports only `lib/play-theme.ts`
- [x] T04 Add createR2Client export to lib/r2.ts after impact check
  - Service: backend
  - Files: `lib/r2.ts`
  - Deps: -
  - Consumes: -
  - Produces: `createR2Client(): S3Client | null`
  - Verify: before the edit, run GitNexus `impact` upstream on the `lib/r2.ts` symbols the change sits beside (`getR2BucketName`, `getR2Endpoint`, `hasR2Config`) and record callers and risk in `docs/features/0002F-emulator-themes-controls/subfeatures/SF04-console-bezels/build-ledger.md`, created here if absent (measured 2026-11-09: `getR2BucketName` HIGH, `getR2Endpoint` CRITICAL — use only, never edit); after the edit, `git diff lib/r2.ts` shows no removed line, and a scratch script in `.codeadd/.temp/` (deleted after use) imports `lib/r2.ts` with tsx and exits 0 when `createR2Client()` returns `null` in a shell without `R2_*`
- [x] T05 Create server bezel storage module over BezelStorage
  - Service: backend
  - Files: `lib/bezel.ts`
  - Deps: T01, T03, T04
  - Consumes: `createR2Client(): S3Client | null` (T04), `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>` (T03), `bezelObjectKey(id: BezelConsoleId): string` (T03)
  - Produces: `isMissingObjectError(error: unknown): boolean`, `etagMatches(ifNoneMatch: string | null, etag: string | null): boolean`, `type BezelR2Client = Pick<S3Client, 'send'>`, `type BezelStorage = { client: BezelR2Client; bucket: string }`, `getBezelStorage(): BezelStorage | null`, `type BezelWriteResult = { kind: 'saved'; key: string } | { kind: 'failed' }`, `type BezelReadResult = { kind: 'found'; body: Uint8Array; etag: string | null; contentLength: number } | { kind: 'not-modified'; etag: string } | { kind: 'missing' } | { kind: 'failed' }`, `type BezelDeleteResult = { kind: 'deleted' } | { kind: 'missing' } | { kind: 'failed' }`, `putBezel(storage: BezelStorage, id: BezelConsoleId, bytes: Uint8Array): Promise<BezelWriteResult>`, `getBezel(storage: BezelStorage, id: BezelConsoleId, ifNoneMatch: string | null): Promise<BezelReadResult>`, `deleteBezel(storage: BezelStorage, id: BezelConsoleId): Promise<BezelDeleteResult>`
  - Verify: a scratch script in `.codeadd/.temp/` (deleted after use) imports `lib/bezel.ts` with tsx in a shell without `R2_*` and exits 0 when `getBezelStorage()` is `null`, `isMissingObjectError` is true for `name` `NoSuchKey`, `NotFound` and `$metadata.httpStatusCode` 404 and false for `AccessDenied`, and `etagMatches` is true for `*`, a `W/` prefix and a comma list; the route-level cases T03, T17–T20 go green in T06
- [x] T06 Create bezel route factories and the two route files
  - Service: backend
  - Files: `lib/bezel-routes.ts`, `app/api/admin/bezels/[console]/route.ts`, `app/api/bezel/[console]/route.ts`
  - Deps: T01, T03, T05
  - Consumes: `isBezelConsoleId(value: unknown): value is BezelConsoleId` (T03), `BEZEL_MAX_BYTES = 2097152` (T03), `BEZEL_MAX_REQUEST_BYTES = BEZEL_MAX_BYTES + 65536` (T03), `hasPngSignature(bytes: Uint8Array): boolean` (T03), `type BezelStorage = { client: BezelR2Client; bucket: string }` (T05), `getBezelStorage(): BezelStorage | null` (T05), `putBezel(storage: BezelStorage, id: BezelConsoleId, bytes: Uint8Array): Promise<BezelWriteResult>` (T05), `getBezel(storage: BezelStorage, id: BezelConsoleId, ifNoneMatch: string | null): Promise<BezelReadResult>` (T05), `deleteBezel(storage: BezelStorage, id: BezelConsoleId): Promise<BezelDeleteResult>` (T05)
  - Produces: `type BezelRouteContext = { params: { console: string } }`, `type BezelRouteDeps = { getStorage: () => BezelStorage | null; readSession?: SessionReader }`, `createAdminBezelHandlers(deps?: Partial<BezelRouteDeps>): { POST: (request: Request, context: BezelRouteContext) => Promise<Response>; DELETE: (request: Request, context: BezelRouteContext) => Promise<Response> }`, `createPublicBezelHandlers(deps?: Partial<BezelRouteDeps>): { GET: (request: Request, context: BezelRouteContext) => Promise<Response> }`
  - Verify: in a shell without `R2_*`, `node --import tsx --test tests/bezel.test.ts` exits 0 (T01–T22), then `npm run build` exits 0; read (never edit) the `matcher` in `middleware.ts`, confirm `/api/bezel/**` is outside it and record the result in the SF04 `build-ledger.md`
- [x] T07 Type Emulator status with EmulatorStatus; add useWideScreen, PlayBezel
  - Service: frontend
  - Files: `components/Emulator.tsx`, `components/useWideScreen.ts`, `components/PlayBezel.tsx`
  - Deps: T02, T03
  - Consumes: `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>` (T03)
  - Produces: `onStatusChange?: (state: EmulatorStatus, attempt: number, total: number, core: string) => void`, `WIDE_MEDIA_QUERY = '(min-width: 1024px) and (pointer: fine)'`, `useWideScreen(): boolean`, `interface PlayBezelProps { consoleId: BezelConsoleId; onLoaded: () => void; onFailed: () => void }`, `PlayBezel({ consoleId, onLoaded, onFailed }: PlayBezelProps)`
  - Verify: before editing `components/Emulator.tsx`, run GitNexus `impact` upstream on `Emulator` and record it; the result is `UNKNOWN` (JSX not indexed), so confirm the callers by text search for `Emulator` imports and record them; after the edits, `npm run build` exits 0 and `git diff components/Emulator.tsx` changes only the `onStatusChange` line (CR-3)
- [x] T08 Add wide: Tailwind variant; StatusStrip and PlayTopBar classes
  - Service: frontend
  - Files: `tailwind.config.ts`, `components/StatusStrip.tsx`, `components/PlayTopBar.tsx`
  - Deps: T02
  - Consumes: -
  - Produces: `theme.extend.screens.wide = { raw: '(min-width: 1024px) and (pointer: fine)' }`
  - Verify: before editing, run GitNexus `impact` upstream on `StatusStrip` and `PlayTopBar` and record it (`UNKNOWN` → confirm callers by text search); after, `npm run build` exits 0, the generated CSS under `.next/static/css` holds a `(min-width: 1024px) and (pointer: fine)` media block with `wide\:` classes, and both components keep their props and exports
- [x] T09 Add bezel state machine, frame modes, globals.css layout
  - Service: frontend
  - Files: `components/ThemedFrame.tsx`, `app/globals.css`, `components/PlayStage.tsx`
  - Deps: T02, T07, T08
  - Consumes: `onStatusChange?: (state: EmulatorStatus, attempt: number, total: number, core: string) => void` (T07), `useWideScreen(): boolean` (T07), `PlayBezel({ consoleId, onLoaded, onFailed }: PlayBezelProps)` (T07), `theme.extend.screens.wide = { raw: '(min-width: 1024px) and (pointer: fine)' }` (T08), `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>` (T03)
  - Produces: `type PlayFrameMode = 'frame' | 'bezel' | 'bare'`, `ThemedFrame(props: { frameStyle: FrameStyle; mode: PlayFrameMode; state: PlayScreenState; onRetry?: () => void; onReload?: () => void; bezel?: ReactNode; children?: ReactNode })`
  - Verify: before editing, run GitNexus `impact` upstream on `PlayStage` and `ThemedFrame` and record it; both return `UNKNOWN` (JSX not indexed), so confirm the callers by text search and record them; after, `npm run build` exits 0; then delete `.next`, free ports 3001/3002, and with `MONGODB_DB=retrokey_e2e` run `npx playwright test e2e/play-screen.qa.spec.ts --project=main`; delete `.next` again and run `npx playwright test e2e/play-screen.qa.spec.ts --project=no-mongo`; both exit 0
- [x] T10 Create BezelsTab and mount it as third admin tab
  - Service: frontend
  - Files: `components/admin/BezelsTab.tsx`, `app/admin/page.tsx`
  - Deps: T02, T03, T06
  - Consumes: `type BezelConsoleId = Exclude<FrameStyle, 'neutral'>` (T03), `isBezelConsoleId(value: unknown): value is BezelConsoleId` (T03), `isBezelAspectOff(width: number, height: number): boolean` (T03)
  - Produces: `interface BezelsTabProps { onAuthError: (status: AdminAuthStatus) => void }`, `BezelsTab({ onAuthError }: BezelsTabProps)`
  - Verify: before editing `app/admin/page.tsx`, run GitNexus `impact` upstream on `AdminPage` and record it (`UNKNOWN` → confirm by text search); after, `npm run build` exits 0, `git diff --name-only` holds no `components/admin/CartridgesTab.tsx`; then delete `.next`, free ports 3001/3002, and with `MONGODB_DB=retrokey_e2e` run `npx playwright test e2e/admin.qa.spec.ts --project=main`; it exits 0
- [x] T11 Add tests/bezel.test.ts to the AGENTS.md test gate
  - Service: infra
  - Files: `AGENTS.md`
  - Deps: T06
  - Consumes: -
  - Produces: -
  - Verify: in a shell without `R2_*` vars, `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts` exits 0, and AGENTS.md `validation_gates.test` (and the Global Constraints copy, if any) holds exactly that command

## Acceptance Checklist

- [x] `lib/bezel-console.ts` imports only `lib/play-theme.ts`; `BEZEL_CONSOLE_IDS` = `FRAME_STYLES` minus `neutral` (12, same order) and `bezelObjectKey(id)` returns `bezels/${id}.png` (RF02)
- [x] `POST /api/admin/bezels/[console]` with an admin session and a PNG returns 201 `{ console, key }`; the fake records one PutObject with Key `bezels/<id>.png`, `ContentType: 'image/png'` and the same bytes; a second upload writes the same key and GET returns the new bytes (RF02)
- [x] `DELETE /api/admin/bezels/[console]` sends HeadObject then DeleteObject and returns 204 with an empty body; when Head reports missing it returns 404 `{error:'No bezel for this console'}` and sends no DeleteObject (RF01)
- [x] `GET /api/bezel/[console]` returns 200 `image/png` with `Cache-Control: no-cache`, `ETag`, `Content-Length` and `X-Content-Type-Options: nosniff`, from one GetObject (RF03, RN05)
- [x] Public route lives at `app/api/bezel/[console]/route.ts` (outside `app/api/admin/**`) with `runtime='nodejs'` and `dynamic='force-dynamic'`; both route files export only HTTP methods plus `runtime`/`dynamic` from the factories; `middleware.ts` is unchanged (RF03)
- [x] POST and DELETE call `requireAdmin(request, deps.readSession)` first: no session → 401 `{error:'Unauthorized'}`, non-admin → 403 `{error:'Forbidden'}`, with 0 R2 commands; GET never calls `readSession` (RN01)
- [x] POST check order follows plan.md: auth → `isBezelConsoleId` → storage → `Content-Length > BEZEL_MAX_REQUEST_BYTES` 413 before `formData()` → non-multipart 400 → unparsable form 400 → no `file` or size 0 400 → `file.size > BEZEL_MAX_BYTES` 413 before `arrayBuffer()` → no PNG signature 415 → `putBezel` (RN02)
- [x] A PNG of exactly 2097152 bytes named `../../evil.jpg` is stored at `bezels/nes.png`; `file.name` is never read; ids `neutral`, `NES`, `../roms/x` and empty return 404 `{error:'Unknown console'}` with no key built (RN02)
- [x] Logs use `[r2]` (key + `error.name`) and `[bezel]` (id + status) only; no bytes, filenames, credentials or session data are logged (RN02)
- [x] `getStorage` null → POST/DELETE 503 `{error:'Storage is not configured'}`; Put/Head/Delete throwing → 502 `{error:'Storage failed'}`; `public/bezels` never exists and `lib/bezel*.ts` import no `lib/mongo` (RN03)
- [x] `lib/r2.ts` diff only adds `createR2Client(): S3Client | null` (null when `hasR2Config()` is false); `getR2BucketName`, `getR2Endpoint` and `uploadRomToR2` are untouched and `uploadRomToR2` is not called by bezel code; the GitNexus impact result for `lib/r2.ts` is recorded (RN03)
- [x] `lib/bezel.ts` functions never throw; `isMissingObjectError` accepts `NoSuchKey`, `NotFound` and `$metadata.httpStatusCode === 404`; `getBezel` on an ETag match returns `not-modified` without reading the body (calls `Body.destroy?.()`) (RN05)
- [x] GET with `If-None-Match` equal to the ETag, `W/`+ETag, `*` or a list holding it returns 304 with no body, `ETag` and `no-cache`; a different tag returns 200 (RN05)
- [x] GET returns 404 `{error:'Bezel not found'}` with `Cache-Control: no-store` and an identical body for `NoSuchKey`, `NotFound`, HTTP 404, storage null and id `neutral`; `AccessDenied` returns 502 `{error:'Storage failed'}` `no-store` (RN05)
- [x] `isBezelAspectOff` is false for 1920×1080, 1600×900, 1280×722 and true for 1024×768, 1920×1100, 1080×1920 (RN06)
- [x] `app/admin/page.tsx` `activeTab` is `'games' | 'cartridges' | 'bezels'`; the tab bar reads Games, Cartridges, Bezels; `{activeTab === 'bezels' && <BezelsTab onAuthError={setAuthError} />}`; `components/admin/CartridgesTab.tsx` is not in the diff and its headings stay "Create new cartridge" and "Cartridges list" (RF01)
- [x] `BezelsTab` shows heading "Bezel por console" and a select of 12 options built from `systemOptions` + `DEFAULT_PLAY_THEMES[value].frame` filtered by `isBezelConsoleId`, values = frame ids, labels = system labels (RF01)
- [x] `BezelsTab` preview fetches `/api/bezel/${consoleId}?v=${previewVersion}` with `cache: 'no-store'` and an `AbortController` per run plus id compare: 200 → has-bezel with Remove on, 404 → "No bezel for this console yet." with Remove off, other → "Could not read this bezel." with Try again; a late response for a previous console is dropped (RF01)
- [x] Upload sends `FormData` with field `file` and no `Content-Type` header; "Uploading..." disables select, file input, Upload and Remove; 201 → `role=status` "Bezel saved for {label}.", input reset, `previewVersion` bump and the preview shows the new image; 400/404/413/415/502/503/abort → `role=alert` text from design.md with the file kept (RF01, RF02)
- [x] Remove asks `confirm("Remove the bezel for {label}?")`; dismiss sends 0 DELETE; 204 → "Bezel removed for {label}." and empty preview; 404/502/503 → `role=alert` and back to has-bezel (RF01)
- [x] 401/403 from POST or DELETE call `onAuthError(status)` (via `getAdminAuthStatus`) and show the existing session-expired panel (RN01)
- [x] The chosen file is measured with `new Image()` on its object URL; `isBezelAspectOff(w, h)` shows the amber `role=status` warning with "1024×768"-style size text, and Upload stays enabled and sends 1 POST (RN06)
- [x] Every object URL in `BezelsTab` is revoked on replace, console change, success and unmount; `file` input has `accept="image/png"` (RF01)
- [x] Bezels tab has 0 axe violations in empty, has-bezel, read-error, file-selected, aspect-warning, upload-error, and select, file label, Upload, Remove, Try again are ≥ 44px (RF01)
- [x] `useWideScreen` returns `false` on first render, then follows `matchMedia(WIDE_MEDIA_QUERY)` and removes its `change` listener on unmount; `PlayBezel` mounts only when `wide && ready && bezelId !== null && (bezel === 'pending' || bezel === 'adopted')` (RF04, RF05)
- [x] `PlayBezel` renders one `<img className="play-bezel-img" src="/api/bezel/<id>" alt="" aria-hidden="true">` without `loading="lazy"`; `onLoad` calls `onLoaded()` only when `naturalWidth > 0`, else `onFailed()`; `onError` calls `onFailed()` (RF04)
- [x] `ThemedFrame` keeps a stable tree `div.play-frame-area[data-mode]` > `div.play-bezel-area` > [bezel slot, `div.play-window[data-window]`], with `data-frame={frameStyle}` only in `frame` mode, so the bezel img never remounts on adoption (RF04)
- [x] `app/globals.css` keeps `bare` as the unscoped default (`.play-bezel-area{display:contents}`, `.play-bezel-img{display:none}`, `.play-window` sized by `--t-ar`) and moves every `[data-frame]` rule under `@media (min-width: 1024px) and (pointer: fine)`; the reduced-motion rule on `[data-frame]` stays (RF04, RF05)
- [x] `tailwind.config.ts` adds `theme.extend.screens.wide = { raw: '(min-width: 1024px) and (pointer: fine)' }`, the same literal as `WIDE_MEDIA_QUERY` and the CSS media (RF04, RF05)
- [x] At 1366×768 fine with a bezel, `[data-mode=bezel]` shows a 16:9 area ±1px centred ±2px, window height = area height ±1px, centred x ±2px, ratio 4/3 ±0.01, `[data-frame]` count 0; at 1920×1080 window/area width = 0.75, 0.625, 0.84375 ±0.005 for arcade, Game Boy, Game Boy Advance (RF04)
- [x] At 1366×768 fine with the bezel missing, `[data-mode=frame]` shows `[data-frame="arcade"]` at ratio 4/3 ±0.02, legend visible, no scroll (RF04)
- [x] At 390×844, 844×390 (fine and touch) and 1366×768 touch: `[data-mode=bare]`, 0 `[data-frame]`, 0 bezel img, 0 requests to `/api/bezel/**`, window 4/3 ±0.02 filling one stage axis ±2px, `scrollHeight ≤ innerHeight`, Back home ≥ 44px, legend hidden (legend class `hidden h-10 shrink-0 wide:block`) (RF05)
- [x] `StatusStrip` keeps `role=status` mounted in every state; on phone it is `absolute inset-x-0 bottom-0 h-8` over `--t-bg`, its text is `sr-only` in running and visible in error states, and the window box is equal in booting and running; in Wide it is an in-flow row (RF05)
- [x] SF01 E2E T05/T06/T07/T17 use `[data-window]`, assert `[data-frame]` count 0 on phone runs, legend hidden at fine 390×844/844×390 and visible at 1366×768, T17 Back home checked inside the panel, and pass in `main` and `no-mongo` (RF05)
- [x] `PlayStage` bezel state machine: `'none'` → `'pending'` only when wide, `bezelId` set and state `booting`; `onLoaded` adopts only while `statusRef.current === 'booting'`, else `'refused'`; `onFailed` → `'refused'`; `adopted`/`refused` are final for the mount; `frameMode = !wide ? 'bare' : bezel === 'adopted' ? 'bezel' : 'frame'` (RN04)
- [x] With a held ready stub the `data-mode` sequence is `[frame, bezel]`, the switch happens while status is Starting game, and the window box moves 0px for 1 s after Running (RN04)
- [x] Bezel 404, 500 or aborted → Running in `frame` mode with no `role=alert` and no bezel text; a 3 s slow bezel arriving after Running leaves the mode `frame` and the window box unchanged (RN04)
- [x] `--project=no-mongo` with `routeBezel missing` reaches Running with the CSS frame and no alert (RN04)
- [x] Every Wide E2E test calls `routeBezel`; server tests use only the injected fake client; no test sets `R2_*`; 0 writes to production R2 during tests and E2E (RN03)
- [x] QA-04: `ACTION_CLASS` uses `px-6`; Retry (metadata-error) and panel Back home (not-found) compute 24px left/right padding (RF04, RF05)
- [x] QA-08: the not-found panel shows `<Link href="/">Back home</Link>` with `ACTION_CLASS`, Retry/Reload count 0 and no iframe (RF04, RF05)
- [x] QA-09: on phone the window is the largest `--t-ar` box, centred in the stage, with no frame border or padding (RF05)
- [x] QA-10: `PlayTopBar` title is `truncate text-lg font-semibold wide:text-2xl` (no `sm:text-2xl`, no max-height variants): 18px on phone, 24px in Wide (RF05)
- [x] QA-11: loading-metadata (game request held, skeleton shown) has 0 axe violations (RF05)
- [x] QA-12: an 80-character title stays one line with `white-space:nowrap` and `text-overflow:ellipsis`; the system label is `hidden wide:block` (RF05)
- [x] QA-13: the skeleton is `div.play-skeleton[aria-hidden]` at 4/3 ±0.02 with the window sizing rule; at 390×844 its box equals the running window box ±2px (RF05)
- [x] CR-1: `screenState = metaState === 'ok' ? emulator.state : META_TO_SCREEN[metaState]`, with no unreachable branch (RF05)
- [x] CR-2: `core = useMemo(() => (ready ? getCoreForSystem(system) : ''), [ready, system])`; no `No system selected` console message from `goto` to Running (RF05)
- [x] CR-3: `Emulator` `onStatusChange` is typed `(state: EmulatorStatus, attempt: number, total: number, core: string) => void` with no other change in `components/Emulator.tsx` (RF05)
- [x] GitNexus impact recorded before editing `lib/r2.ts`, `Emulator`, `StatusStrip`, `PlayTopBar`, `ThemedFrame`, `PlayStage` and `AdminPage`; each `UNKNOWN` result is followed by a recorded text search of callers (RN04)
- [x] No file changed under `lib/mongo.ts`, `lib/admin-login.ts`, `lib/login-throttle.ts`, `lib/auth-guard.ts`, `auth.ts`, `auth.config.ts`, `middleware.ts`, `app/api/auth/**`, existing `app/api/admin/**` routes, `components/admin/CartridgesTab.tsx`, `app/nfc/**`; `/api/rom/[slug]` stays public and unchanged (RN01, RN04)
- [x] AGENTS.md `validation_gates.test` runs `tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts` (RF02, RN02, RN05)

## Validation Gates

- [x] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts tests/bezel.test.ts` (in a shell without `R2_*` vars) and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
- [x] Before each commit, run `node .gitnexus/run.cjs detect-changes --scope all --repo .`; a `partial`/`truncated` result or an index with no symbols is recorded as NOT VERIFIED with the `git diff --name-only` list
