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
| T39 | frontend-RF01-bezel-block-placement | frontend | RF01 | admin logged in, tab Cartuchos | heading "Bezel por console" after "Create new cartridge" card, before list; select has 12 options, values = ids | DOM order; option values; cartridge form field labels equal pre-SF04 list |
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
| Metric: 0 writes to production R2 | T02-T20 use the injected fake only; T23-T48 route every bezel call (T46 dropped by the coordinator: owner rule "E2E só com page.route") | ✅ |

Coverage: 11/11 RF/RN (100%) · review-001 in scope: 8/10 with a test signal, CR-1 and CR-3 review-only.
