---
id: wiki/domains/frontend
type: reference
area: frontend
description: RetroKey frontend on Next.js 14 App Router + React 18 + Tailwind — pages, client fetch-in-useEffect data pattern, next-auth session gating of /admin, the iframe emulator with core fallback, admin CRUD tabs, styling tokens. Read before adding a page, component or form.
sources: [app/**/page.tsx, app/layout.tsx, app/Providers.tsx, app/globals.css, components/**, lib/emulator-cores.ts, lib/auth-config.ts, public/emulator.html]
commit: 17bd8acf
generated: 2026-11-05
tags: [nextjs-app-router, tailwind, next-auth, emulator, useeffect-fetch, admin-crud]
---

# Frontend

## TL;DR

Next.js 14.2 App Router with React 18.2 and Tailwind 3.4, no UI library, no state library, no data-fetching library, no form library. Client components fetch same-origin `/api/**` routes with raw `fetch` inside `useEffect` and hold results in `useState`. The one non-trivial piece is `Emulator`, which drives an iframe (`public/emulator.html`, EmulatorJS) through a list of fallback cores until the iframe sends a ready message. The admin area is gated client-side with `useSession` from next-auth v5.

## TOC

- [Framework & Build](#framework--build)
- [Routing & Rendering Modes](#routing--rendering-modes)
- [State & Data Fetching](#state--data-fetching)
- [Auth on the Client](#auth-on-the-client)
- [Emulator Integration](#emulator-integration)
- [Forms](#forms)
- [Styling](#styling)
- [Environment Variables](#environment-variables)
- [Reusable Abstractions](#reusable-abstractions)
- [Project Conventions](#project-conventions)
- [Testing](#testing)
- [Watch-outs](#watch-outs)

## Framework & Build

Next.js App Router project built with `next build`. The dev server and `next start` both use port 3001 (`package.json` scripts). The package manager is npm (`package-lock.json`). TypeScript runs in `strict` mode, and the `@/*` alias maps to the repo root (`tsconfig.json`).

Config: `{"framework":"next","version":"14.2.15","react":"18.2.0","build":"next","pkg":"npm","port":3001,"alias":"@/* -> ./*"}`

The root layout injects an inline script that replaces `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` with a frozen no-op hook (`app/layout.tsx:5-41`, injected at `:53`). The code does not say why. It appears to protect the page from devtools extensions, possibly ones that break when EmulatorJS runs. Do not remove it without checking the emulator page in a browser that has the React DevTools extension installed.

## Routing & Rendering Modes

The routes are files under `app/`. Each page picks its rendering mode on purpose, so check the mode before you edit a page:

| Route | Mode | Why |
|---|---|---|
| `/` `app/page.tsx` | Server | Static hero plus a hard-coded `games` array (`:4-7`). Live rooms come from the client `RoomsSection` |
| `/rooms/[slug]` `app/rooms/[slug]/page.tsx` | Async server | Calls `getRoomBySlug` from `lib/data` directly, with no API hop, and sets the title in `generateMetadata` (`:5-11`) |
| `/play/[slug]` `app/play/[slug]/page.tsx` | Client | Fetches `/api/game/[slug]`, then mounts `Emulator` |
| `/nfc/[id]` `app/nfc/[id]/page.tsx` | Client | POSTs to `/api/nfc/validate` and shows a "Continue" link to the `redirectTo` it returns |
| `/admin` `app/admin/page.tsx` | Client | Session-gated, with tabs for Games and Cartridges |
| `/login` `app/login/page.tsx` | Server shell | Wraps `LoginForm` in `<Suspense>` because the form calls `useSearchParams` |

```tsx
// app/rooms/[slug]/page.tsx:13-16
export default async function RoomPage({ params }: { params: { slug: string } }) {
  const room = await getRoomBySlug(params.slug);

  if (!room) {
```

Dynamic params arrive as the synchronous `{ params: { slug: string } }` prop, which is the Next 14 signature, not a Promise. There is no `loading.tsx`, `error.tsx` or `not-found.tsx`. Each page renders its own loading and not-found markup inline. `middleware.ts` has `matcher: []`, so it never runs and no route is protected server-side by middleware.

The GitNexus `route_map` (repo `Portifolio`) was used to verify which component calls which API route. Re-run it rather than trusting a list here.

## State & Data Fetching

There is no store and no query library. Server data lives in component `useState`, is loaded once in `useEffect`, and is reloaded by calling the same loader again after each mutation. This is the project's whole caching and invalidation model.

```tsx
// components/RoomsSection.tsx:8-26
const [rooms, setRooms] = useState<Room[]>([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  async function loadRooms() {
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) setRooms(await response.json());
    } catch (error) { console.error('Failed to load rooms', error); }
    finally { setLoading(false); }
  }
  loadRooms();
}, []);
```

Conventions that follow from this pattern:
- Every fetch URL is relative and same-origin (`/api/...`). There is no API client and no base URL.
- When `!response.ok`, a load fails silently and the list stays empty. Mutations read `data.error` from the JSON body and fall back to a fixed message (`components/admin/GamesTab.tsx:96-98`).
- After a successful mutation, the code calls `loadGames()` or `loadData()` again to re-sync (`components/admin/GamesTab.tsx:94`, `components/admin/CartridgesTab.tsx:65`).
- `CartridgesTab` loads `/api/admin/games` and `/api/admin/cartridges` in parallel with `Promise.all` (`components/admin/CartridgesTab.tsx:25-28`). It needs the games list both for its select and to turn `gameId` into a title (`:97-99`).
- Lists render three states with a nested ternary: loading, then empty, then items (`components/RoomsSection.tsx:37-70`). Keep all three when you add a list.

UI-only state, such as the active tab, the editing id or a feedback string, is also local `useState` (`app/admin/page.tsx:12`). There is no global UI state.

## Auth on the Client

`app/Providers.tsx` wraps the whole tree in next-auth's `SessionProvider`, and `app/layout.tsx:56` mounts it. That provider is what makes `useSession`, `signIn` and `signOut` work in client components.

```tsx
// app/admin/page.tsx:11-21
const { data: session, status } = useSession();
useEffect(() => {
  if (status === 'unauthenticated') {
    router.replace('/login?callbackUrl=/admin');
  }
}, [router, status]);
```

- `/admin` renders a loading screen while `status === 'loading'` and `null` when there is no session (`app/admin/page.tsx:23-33`). The redirect happens on the client.
- `LoginForm` calls `signIn('credentials', { redirect: false })`, checks `result.error`, then calls `router.push(callbackUrl)`. `callbackUrl` defaults to `/admin` (`components/login/LoginForm.tsx:23-48`).
- Logout is `signOut({ callbackUrl: '/login' })` (`app/admin/page.tsx:44`).
- The real authorization boundary is in the API routes. The client gate only decides what renders. See [backend.md](backend.md).

## Emulator Integration

`components/Emulator.tsx` does not run a ROM itself. It points an iframe at `/emulator.html?title=&core=&rom=/api/rom/<slug>` (`:128-135`). The static page `public/emulator.html` boots EmulatorJS from `cdn.emulatorjs.org` (`public/emulator.html:36`) and posts `{type:'EMULATOR_CANVAS_READY'}` to the parent once a canvas exists (`:182`).

Lifecycle, which is a small state machine held in refs so timers and the message listener never read stale state:
1. `getCoreCandidates(core)` expands a core or system alias into an ordered fallback list. For example, `nes` becomes `['fceumm','nestopia']` (`components/Emulator.tsx:16-44`).
2. `tryCore(i)` sets the iframe URL after `RETRY_DELAY_MS` (250ms) and arms a `FALLBACK_TIMEOUT_MS` (10s) timer (`:105-162`).
3. The ready message moves the state to `running` and clears the timer (`:169-182`). A timeout or an iframe `onError` moves on to the next candidate.
4. Unmount sets `cancelledRef` and removes the listener (`:187-191`).

```tsx
// components/Emulator.tsx:169-176
const handleMessage = (event: MessageEvent) => {
  if (event.data?.type === 'EMULATOR_CANVAS_READY') {
    if (cancelledRef.current || stateRef.current !== 'loading') return;
    stateRef.current = 'running';
    cleanupCurrentAttempt();
```

The play page maps the game's `system`/`console` string to a core with `getCoreForSystem` from `lib/emulator-cores.ts:51`. That function tries an exact match against `systemToCoreMap` first, then legacy substring matches, and falls back to `fceumm`. To add a console, change three places in step:
- `EmulatorSystem`, `systemOptions` and `systemToCoreMap` in `lib/emulator-cores.ts`
- the alias table in `getCoreCandidates`
- the control-scheme branches in `public/emulator.html`

`iframe key={iframeUrl}` forces a remount on every attempt (`components/Emulator.tsx:202`). Keep it, because EmulatorJS cannot be re-initialized inside the same document.

## Forms

Forms are hand-written controlled inputs with HTML `required` attributes. There is no form library and no schema validation on the client. The server validates.

- Admin forms keep one `form` object in state and update it with `setForm({ ...form, field: value })` (`components/admin/GamesTab.tsx:143`).
- `GamesTab` sends `multipart/form-data`. Booleans are converted to `'true'` or `'false'` strings, and the optional ROM goes in as `romFile` (`components/admin/GamesTab.tsx:72-89`). The same form handles both POST (create) and PUT (edit), based on `editingId` (`:70-71`).
- `CartridgesTab` sends JSON and runs `collectionNumber` through `parseInt` (`components/admin/CartridgesTab.tsx:48-55`).
- `LoginForm` is uncontrolled and reads its values with `new FormData(event.currentTarget)` (`components/login/LoginForm.tsx:20-22`).
- Feedback and errors render as a single `<p>`. Destructive actions ask `confirm()` first (`components/admin/GamesTab.tsx:106`).

```tsx
// components/admin/GamesTab.tsx:70-89
const endpoint = editingId ? `/api/admin/games/${editingId}` : '/api/admin/games';
const method = editingId ? 'PUT' : 'POST';
const formData = new FormData();
Object.entries(form).forEach(([key, value]) => {
  if (typeof value === 'boolean') formData.append(key, value ? 'true' : 'false');
  else formData.append(key, value);
});
if (romFile) formData.append('romFile', romFile);
```

UI copy mixes Portuguese and English. Admin and login text is mostly Portuguese ("Sair", "Entrar", "Credenciais inválidas."), while the public pages are in English. Match the language of the screen you are editing.

## Styling

The styling is plain Tailwind utilities written inline, with no component classes, no `cn()` helper and no theme extension (`tailwind.config.ts:5-7`). `app/globals.css` sets the dark base: `color-scheme: dark` and `body` with `bg-zinc-950 text-zinc-100`.

Recurring visual vocabulary. Copy these classes, because there are no shared components for them:

| Element | Classes |
|---|---|
| Page shell | `mx-auto min-h-screen max-w-{3xl..6xl} px-6 py-16` |
| Primary card | `rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8` |
| Inner card | `rounded-2xl border border-zinc-800 bg-zinc-950 p-5/p-6` |
| Eyebrow label | `text-sm uppercase tracking-[0.3em] text-cyan-400` |
| Primary CTA | `rounded-full bg-cyan-500 px-5 py-3 font-medium text-zinc-950 hover:bg-cyan-400` |
| Admin input | `rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500` |

```tsx
// app/nfc/[id]/page.tsx:37-39
<main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
    <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">NFC validation</p>
```

Two exceptions: `/login` uses a `slate` palette with an `amber-500` button (`app/login/page.tsx:6`, `components/login/LoginForm.tsx:80`), and the emulator iframe uses inline `style` (`components/Emulator.tsx:204-209`). Tailwind's `content` only scans `app/**` and `components/**`, so classes placed anywhere else are purged.

## Environment Variables

The frontend reads no `NEXT_PUBLIC_*` variables. All fetches are same-origin, so it needs no base URL. Do not use non-public env vars in client components. In particular, `getAdminLoginHint` reads `ADMIN_USERNAME`/`ADMIN_PASSWORD` (`lib/auth-config.ts:13-23`) and is called from the client `LoginForm` (`components/login/LoginForm.tsx:13`). In the browser bundle those values are `undefined`, so the client always shows the dev-mode hint.

## Reusable Abstractions

Reuse these before you write something new.

**Components:**
- `Emulator` at `components/Emulator.tsx`. Props: `{ gameSlug, gameTitle, core? }`. The iframe plus core-fallback runner. Always use it to play a game.
- `RoomsSection` at `components/RoomsSection.tsx`. Self-fetching list of rooms with loading, empty and items states, embedded on the home page.
- `GamesTab` and `CartridgesTab` at `components/admin/`. Self-contained CRUD panels, and the templates for any new admin tab: form card on top, list card below.
- `LoginForm` at `components/login/LoginForm.tsx`. Credentials sign-in. It must be rendered inside `<Suspense>`.
- `Providers` at `app/Providers.tsx`. Add any new client-wide context here.

**Utilities:**
- `getCoreForSystem`, `systemOptions` and `systemToCoreMap` at `lib/emulator-cores.ts`. Map a system to a core, and feed the admin system select.
- `getAdminLoginHint` at `lib/auth-config.ts`. Login hint text. See the env caveat above.

**Types:**
- `models/game.ts` (`Game`, `Room`) and `models/cartridge.ts` (`Cartridge`) are shared by the UI and the API. Import them with `import type` (`components/admin/CartridgesTab.tsx:4-5`). Only `app/play/[slug]/page.tsx:8-12` declares its own narrower local `Game` interface.

## Project Conventions

Domain-local rules only. For project-wide rules see [conventions.md](../conventions.md).

- **File naming:** components and their files are PascalCase (`RoomsSection.tsx`, `admin/GamesTab.tsx`), each with a single `export default function`. `Providers` is the one named export.
- **Placement:** components shared across routes go in `components/`, and feature-scoped ones go in `components/<feature>/` (`admin/`, `login/`). Pages stay thin and compose those components.
- **New route:** add `app/<segment>/page.tsx`. Use a server component unless the page needs hooks or browser APIs. If it does, put `'use client'` (the code uses both quote styles) on line 1.
- **Imports:** use `@/components/...`, `@/lib/...` and `@/models/...`, and relative imports only inside `app/` (`./Providers`).
- **Logging:** use `console.*` with bracketed prefixes (`[admin]`, `[login]`, `[emulator]`). Keep the prefix when you add logs.
- **Co-location:** there are no component-level styles and no tests next to components.

## Testing

No component tests exist. `tests/*.test.ts` runs on `node --test` and covers lib code (`npm run test:auth`), not UI. `@playwright/test` and `@axe-core/playwright` are installed, but this commit has no Playwright config or specs. For UI changes, verify with `npm run build` and a manual pass in the browser, especially `/play/<slug>` for emulator changes.

## Watch-outs

- Admin protection is client-only (middleware `matcher: []`). Never treat a hidden UI element as authorization.
- Silent load failures leave lists empty with no error state. Users see the "No games yet." text instead.
- `app/page.tsx:4-7` hard-codes demo games. They are not read from the database.
- The `/play` page renders `Emulator` even when the game fetch fails. In that case it falls back to `params.slug` and the default core (`app/play/[slug]/page.tsx:52-56`).
- `postMessage` from the iframe uses target `'*'`, and the listener does not check `event.origin` (`components/Emulator.tsx:169-170`).

## Related

- [architecture.md](../architecture.md): how the Next.js app, API routes and storage fit together
- [backend.md](backend.md): the `/api/**` contracts these components call, and server-side auth
- [database.md](database.md): the `Game`, `Room` and `Cartridge` shapes behind the shared models
- [conventions.md](../conventions.md): project-wide naming and style conventions
