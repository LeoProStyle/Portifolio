---
id: wiki/domains/database
type: reference
area: database
description: RetroKey data layer - raw MongoDB driver, games/cartridges collections, mock-data fallback, admin in-memory store, seed script, and how romPath links to ROM files in Cloudflare R2. Read before changing a model or any Mongo call.
sources: [lib/mongo.ts, lib/data.ts, lib/mock-data.ts, lib/admin-store.ts, lib/r2.ts, models/**, scripts/seed.ts, app/api/**/route.ts]
commit: 17bd8acf
generated: 2026-11-05
tags: [mongodb, mock-fallback, seed, romPath, r2, no-orm]
---

# Database

## TL;DR

RetroKey uses MongoDB through the official `mongodb` driver (`package.json:17`, no ORM, no migrations, no repository classes). Models are plain TypeScript `type` aliases. Reads go through `lib/data.ts` and fall back to `lib/mock-data.ts` when Mongo is unreachable; admin writes happen inline in `app/api/admin/**/route.ts`. `romPath` on a game points to a ROM file in R2 or `public/roms`. Seeding is `npm run seed`. No tenancy, no RLS.

## TOC

- [Database Type and Connection](#database-type-and-connection)
- [Models](#models)
- [Read Path and Mock Fallback](#read-path-and-mock-fallback)
- [Write Path (Admin Routes)](#write-path-admin-routes)
- [Admin In-Memory Store](#admin-in-memory-store)
- [romPath and R2](#rompath-and-r2)
- [Database Conventions](#database-conventions)
- [Seeding](#seeding)
- [Change Checklist](#change-checklist)
- [Related](#related)

## Database Type and Connection

MongoDB, reached via one lazily created, cached `MongoClient` promise (`lib/mongo.ts:8-31`). The URI comes from env var `MONGODB_URI` (throws if empty, `lib/mongo.ts:14-16`); the database name comes from `MONGODB_DB`, default `retrokey` (`lib/mongo.ts:35`). No pool size or timeout options are set, so driver defaults apply. Stable API `v1` with `strict` and `deprecationErrors` is enabled, so any command outside the Stable API will fail.

Config: `{"type":"MongoDB","driver":"mongodb@^7","connection":"MONGODB_URI","db":"MONGODB_DB (default retrokey)","pool":"driver defaults"}`

```ts
// lib/mongo.ts:18-27
if (!clientPromise) {
  client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });
  clientPromise = client.connect();
}
return clientPromise;
```

Watch out: a failed first `connect()` stays cached in `clientPromise`, so later calls reuse the rejected promise until the process restarts.

## Models

Entities are TypeScript `type` aliases, not classes or schemas, and nothing validates documents at the database level (`models/game.ts:1`, `models/cartridge.ts:1`). Collections are `games` and `cartridges`, typed via `db.collection<Game>('games')`. `Room` is declared in `models/game.ts` but is not a Mongo collection; rooms come from R2 (`lib/r2.ts:100`) with a mock fallback.

Documents carry an app-generated string `id` (`game-<Date.now()>`, `cartridge-<Date.now()>`), separate from Mongo's `_id`. Lookups always use `{ id }`, never `_id`.

```ts
// models/cartridge.ts:1-7
export type Cartridge = {
  id: string;
  nfcId: string;
  gameId: string;        // refers to Game.id, not enforced by the database
  collectionNumber: number;
  status: 'active' | 'disabled';
};
```

Constrained values (`status`, `Room.status`) are string unions in TypeScript only. No indexes or unique constraints are created anywhere in the code, so slug/nfcId uniqueness is not enforced.

## Read Path and Mock Fallback

Public reads live in `lib/data.ts` and degrade gracefully: a Mongo error is caught, a warning is logged, and mock data is used.

- `getGames()` merges `mockGames` with DB games, de-duplicated by normalized slug; DB entries come last and win (`lib/data.ts:15-38`). Mock games are therefore always present, even when Mongo works.
- `getCartridges()` returns DB rows only if the collection is non-empty, otherwise `mockCartridges` (`lib/data.ts:40-52`).
- `validateCartridge(nfcId)` joins cartridge to game in application code (no `$lookup`), requiring `status === 'active'` and `game.active` (`lib/data.ts:66-82`).
- `getGameBySlug` loads all games and filters in memory (`lib/data.ts:54-64`).

```ts
// lib/data.ts:15-27
let dbGames: Game[] = [];
try {
  const db = await getDb();
  dbGames = await db.collection<Game>('games').find({}).toArray();
} catch (error) {
  console.warn('MongoDB not available, falling back to mock data.', error);
}
const mergedGames = [...mockGames, ...dbGames];
```

Pattern: every public data function is whole-collection `find({})` plus in-memory filtering. Fine at demo scale; add Mongo queries and indexes if the catalog grows.

## Write Path (Admin Routes)

Only `app/api/admin/**` writes to Mongo, and it does so inline with `getDb()` plus the collection API, with no repository layer (`app/api/admin/games/route.ts:59`, `app/api/admin/cartridges/route.ts:28`). Verbs used: `find`, `findOne`, `insertOne`, `updateOne` with `$set`, `deleteOne`. `lib/data.ts` is read-only. The seed script is the only other writer.

The two admin areas differ in failure behavior:

- Games: when Mongo is unavailable, GET/POST/PUT/DELETE fall back to the in-memory store (`app/api/admin/games/route.ts:13`, `:72`).
- Cartridges: no fallback; a Mongo error returns HTTP 500 (`app/api/admin/cartridges/route.ts:10-13`).

```ts
// app/api/admin/cartridges/route.ts:21-33
const newCartridge: Omit<Cartridge, 'id'> = {
  nfcId: body.nfcId, gameId: body.gameId,
  collectionNumber: body.collectionNumber, status: body.status || 'active'
};
const result = await db.collection<Cartridge>('cartridges').insertOne({
  ...newCartridge, id: `cartridge-${Date.now()}`
} as Cartridge);
return NextResponse.json({ id: result.insertedId, ...newCartridge }, { status: 201 });
```

Watch out:
- The games POST generates `id` twice (`Date.now()` called separately, `app/api/admin/games/route.ts:61` and `:64`) and responds with `result.insertedId` (Mongo `_id`) as `id`, not the stored string `id`. Clients receive an identifier that does not match the `{ id }` used by later lookups.
- The cartridge POST also returns `insertedId` as `id`.
- No input validation or referential check (`gameId` may point at nothing).
- Admin GET returns raw documents including `_id`.

Public vs admin: public pages read via `lib/data.ts` (mock merged); admin lists read straight from the collection (no mock merge in the Mongo path). The two views of "all games" can differ.

## Admin In-Memory Store

`lib/admin-store.ts` holds module-level arrays seeded from the mocks (`lib/admin-store.ts:5-6`), used only as the games write/read fallback when Mongo is down. State lives per server process, is lost on restart, and is not shared across serverless instances. `resetAdminStores()` restores the mocks (`lib/admin-store.ts:16-19`). There is no in-memory equivalent for cartridges.

## romPath and R2

`Game.romPath` is a string reference to a ROM file, not the file itself (`models/game.ts:9`). Three shapes occur:

- R2 key such as `roms/<slug>.<ext>`, produced by `buildRomObjectKey` (`lib/r2.ts:34-50`) and returned by `uploadRomToR2`.
- Local path `/roms/<file>`, written under `public/roms` when R2 credentials are absent (`lib/r2.ts:105-120`). Mock and seed data use this shape (`lib/mock-data.ts:13`, `scripts/seed.ts:14`).
- Free text passed in the JSON body (`app/api/admin/games/route.ts:35`).

Admin create/update uploads the file first, then stores the returned path in the document (`app/api/admin/games/route.ts:29-32`). Serving resolves it back: after stripping a leading `/`, a path starting with `roms/` is fetched from R2, anything else is read from `public/` (`app/api/rom/[slug]/route.ts:90-121`). Consequence: a locally stored `/roms/x.bin` also starts with `roms/` once normalized and is looked up in R2, so a local-only upload can 404 on the serving route once R2 is configured. Rooms are likewise stored in R2 as a JSON object (`R2_ROOMS_KEY`, default `rooms.json`, `lib/r2.ts:30`), not in Mongo. Deleting a game does not delete its R2 object (no delete call in `lib/r2.ts`).

```ts
// app/api/rom/[slug]/route.ts:90-98
const romPath = game.romPath || '';
const normalizedRomPath = romPath.startsWith('/') ? romPath.slice(1) : romPath;
if (normalizedRomPath.startsWith('roms/')) {
  const fileBuffer = await fetchRomFromR2(normalizedRomPath);
```

R2 env vars (names only): `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ROOMS_KEY`.

## Database Conventions

- No migrations tool: Mongo is schemaless here. A model change means editing `models/*.ts`, `lib/mock-data.ts`, `scripts/seed.ts`, and the admin routes' field mapping together; existing documents are not migrated.
- Naming: collections lowercase plural (`games`, `cartridges`); fields camelCase; type names singular PascalCase.
- New collection: add a `type` in `models/`, access with `db.collection<T>('name')`, add mock data and a read function in `lib/data.ts` if it is public. There is no registration step.
- Ids: string `id` generated in the route as `<entity>-<Date.now()>`; query by `{ id }`.
- Every Mongo access goes through `getDb()` from `lib/mongo.ts`; never construct a second `MongoClient`.
- Tenancy: none (no tenant key or RLS). Project-wide rows are in [conventions.md](../conventions.md).
- Reusable abstractions: only `getDb`/`getMongoClient` (`lib/mongo.ts`), `normalizeSlug` (private to `lib/data.ts:7`), and the `lib/data.ts` read functions. No base repository, pagination helper, or transaction wrapper exists.

## Seeding

`scripts/seed.ts` inserts sample games and cartridges only when the target collection is empty (`countDocuments() === 0`), so it is idempotent but never updates existing data (`scripts/seed.ts:72-86`). It exits with code 1 on error. It requires `MONGODB_URI` in the environment.

Config: `{"file":"scripts/seed.ts","run":"npm run seed","runner":"tsx"}`

```ts
// scripts/seed.ts:72-78
const gamesCount = await gamesCollection.countDocuments();
if (gamesCount === 0) {
  await gamesCollection.insertMany(sampleGames);
}
```

## Change Checklist

- Before changing a model field or a `lib/data.ts` function, run GitNexus `impact` (repo `Portifolio`) on the symbol for the exact consumer list rather than relying on this page. `Game.romPath` is also referenced by UI code (`components/admin/GamesTab.tsx`).
- Update the three data sources in step: Mongo documents, `lib/mock-data.ts`, `scripts/seed.ts`.
- Remember the mock merge: mock games always appear in public reads, so a DB game with the same normalized slug overrides a mock one, and a deleted DB game may reveal the mock one.
- Verify manually: there is no test suite for the data layer. Check `/api/admin/games`, `/api/nfc/validate`, and `/api/rom/<slug>` with Mongo both reachable and unreachable.

## Related

- [conventions.md](../conventions.md): project-wide naming, error handling, stack conventions
- [architecture.md](../architecture.md): layers and where the data layer sits
- [backend.md](backend.md): API routes that consume this data layer
