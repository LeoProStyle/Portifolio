# RetroKey MVP

This folder contains the current RetroKey MVP implementation built with Next.js, TypeScript, Tailwind CSS, and a simple admin flow.

## Project Structure
- **app/** - main routes, API handlers, and provider setup
- **components/** - shared UI pieces, admin tabs, and the emulator shell
- **lib/** - data access, MongoDB connection, and mock data fallback
- **models/** - TypeScript types for games, cartridges, users, and sessions
- **public/** - static assets such as the emulator shell and other public files
- **scripts/** - database seeding utilities

## Current Status

The project now includes:
- A public landing page at `/`
- An NFC validation flow at `/nfc/[id]`
- A playable game route at `/play/[slug]`
- A live rooms experience at `/rooms/[slug]` backed by Cloudflare R2 when configured, with mock-data fallback locally
- An admin dashboard at `/admin`
- API routes for validation, game metadata, ROM access, and admin CRUD operations
- Optional MongoDB integration for other content, with mock-data fallback for local development
- A browser-based emulator embedded through an iframe

Recent changes (2026-07-06):
- **Admin upload:** Admin create/edit flows now accept `multipart/form-data` and support uploading ROM files from the admin UI.
- **ROM storage:** Added Cloudflare R2 support via the S3-compatible client. When `R2_*` env vars are configured the app uploads ROMs to R2; otherwise it falls back to `public/roms` local storage.
- **MongoDB persistence:** The app now reads `MONGODB_URI`/`MONGODB_DB` from the environment and persists games when a DB is available, with an in-memory fallback for local development.
- **Env templates:** `.env.example` and `.env.local` were updated to include an explicit `R2_ENDPOINT` example and the required R2 variables.
- **Verification:** A direct upload test was run; initial Access Denied was resolved by granting the API token object-write permission and subsequent tests confirmed uploads succeed.

## Getting Started

### 1. Prerequisites
- Node.js 18+
- npm
- Optional: MongoDB Atlas account for persistent data

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

If you want to use MongoDB, create a `.env.local` file with:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=retrokey
```

If you want rooms backed by Cloudflare R2, copy `.env.example` to `.env.local` and fill the values:

```bash
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=retrokey-room-data
R2_ACCOUNT_ID=your-account-id
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ROOMS_KEY=rooms.json
```

If neither storage option is configured, the app will use mock data from `lib/mock-data.ts`.

For local admin access, the default credentials are `admin` / `admin123` unless you override them with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

### 4. Seed the database (optional)

```bash
npm run seed
```

### 5. Run the development server

```bash
npm run dev
```

Open http://localhost:3001 in your browser.

## Core User Flow

### Public Flow
1. `/` - Home page with the game list
2. `/nfc/{id}` - Cartridge validation screen
3. `/play/{slug}` - Game launch page with the emulator shell

### Admin Flow
- `/admin` - Tabbed interface for games and cartridges
- **Games Tab**: create and manage games with inline feedback
- **Cartridges Tab**: link NFC tags to games and manage status with inline feedback

## Emulator Integration

- The play page embeds an emulator shell through `components/Emulator.tsx`
- The emulator loads the ROM through `/api/rom/{slug}`
- The page is designed to be compatible with browser-based emulation workflows

## API Endpoints

- `POST /api/nfc/validate` - validate a cartridge and prepare a launch flow
- `GET /api/game/[id]` - get game metadata
- `GET /api/rom/[slug]` - serve ROM content through the app layer
- `GET /api/rooms` - list rooms
- `GET /api/rooms/[slug]` - get a room by slug
- `GET /api/admin/games` - list games
- `POST /api/admin/games` - create a game
- `PUT /api/admin/games/[id]` - update a game
- `DELETE /api/admin/games/[id]` - delete a game
- `GET /api/admin/cartridges` - list cartridges
- `POST /api/admin/cartridges` - create a cartridge
- `PUT /api/admin/cartridges/[id]` - update a cartridge
- `DELETE /api/admin/cartridges/[id]` - delete a cartridge

## Data Layer

The app uses a layered strategy:
- Rooms prefer Cloudflare R2 when `R2_*` credentials are configured.
- MongoDB remains available as an optional backend for other content.
- When no storage backend is configured, it falls back to mock data in `lib/mock-data.ts`.

This keeps local development simple while preserving a path to a real storage-backed deployment.

## Local Development Notes

- The local dev server runs on port `3001`.
- If another process is using that port, stop it before launching the app.
- `npm run build` should succeed before deployment.

## Deployment Notes

### Vercel
```bash
npm run build
npm start
```

Then connect the repository to Vercel and configure the environment variables in the dashboard.

### Environment variables for production
- `MONGODB_URI`
- `MONGODB_DB`
- Optional: Cloudflare R2 credentials for room metadata storage

## Next Steps

1. Harden session and admin protections.
2. Improve ROM storage and delivery.
3. Add deeper gameplay features such as saves, achievements, and profiles.
4. Publish room metadata to a Cloudflare R2 bucket as `rooms.json` for real-time room management.
5. Expand the physical NFC experience with stronger authentication and better device integration.

## File Locations
- **Models**: `models/`
- **Database layer**: `lib/mongo.ts`, `lib/data.ts`
- **Admin UI**: `components/admin/`
- **Admin page**: `app/admin/`
- **API routes**: `app/api/`
- **Seed script**: `scripts/seed.ts`
- **Emulator component**: `components/Emulator.tsx`
- **Emulator HTML**: `public/emulator.html`

