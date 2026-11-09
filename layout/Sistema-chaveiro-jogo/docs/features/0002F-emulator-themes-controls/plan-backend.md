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
