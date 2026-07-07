# RetroKey - Product Requirements Document (PRD)

Version: 1.1 Date: 2026-07-06 Status: MVP in progress

# 1. Product Vision

RetroKey is a browser-first retro gaming experience that connects NFC-style cartridges to playable game sessions. The current MVP focuses on a simple flow: a user opens an NFC route, validation succeeds, and the app launches a compatible game in the browser.

## Goals

- Deliver a nostalgic cartridge experience.
- Keep the core flow browser-only and lightweight.
- Provide a practical admin area for games and cartridges.
- Support local development with mock data and optional MongoDB.
- Keep the architecture modular and ready for future cloud growth.

# 2. Target Audience

- Retro gamers
- Collectors
- Gift buyers
- Gaming stores
- Event organizers

# 3. Current Core User Journey

1. User opens an NFC route such as /nfc/{id}.
2. The app validates the cartridge through /api/nfc/validate.
3. If the cartridge is valid, the user is redirected to the game launch route.
4. The emulator loads the selected game inside the browser.
5. Admin users can manage games and cartridges from /admin.

### Recent implementation notes (2026-07-06)

- Admin UI now supports uploading ROM files via the Games tab. The backend routes (`POST /api/admin/games` and `PUT /api/admin/games/[id]`) accept `multipart/form-data` and will upload provided ROMs to Cloudflare R2 when configured.
- ROM files: the app attempts to write ROMs to R2 using the S3-compatible client and falls back to local `public/roms` if R2 is unavailable or credentials lack write permission.
- Data persistence: `MONGODB_URI` / `MONGODB_DB` are used when present; otherwise, the admin APIs operate against an in-memory store for development.
- Environment: `.env.example` updated to show `R2_ENDPOINT` format and required R2 variables; `.env.local` includes example/test values (ensure you replace secrets for production).

# 4. Functional Requirements

## Public experience

- Launch a game from an NFC-style flow.
- Provide a responsive experience on desktop and mobile.
- Load a game through an embedded emulator page.
- Offer a fallback experience when ROM assets are not available yet.

## Admin experience

- Access the admin dashboard.
- Create, edit, and remove games.
- Create, edit, and remove cartridges.
- Associate cartridges with games.
- Disable inactive cartridges.

# 5. Non-functional Requirements

- Mobile-friendly interface.
- Fast local development cycle.
- TypeScript-first implementation.
- App Router structure with route handlers.
- Clear fallback behavior when database services are unavailable.

# 6. Current Technology Stack

Frontend:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React 18

Backend:
- Next.js Route Handlers
- MongoDB Atlas (optional)
- NextAuth for admin/session handling

Infrastructure:
- Local development on port 3001
- Vercel-ready structure
- Cloudflare R2 as a future storage target

Emulation:
- EmulatorJS embedded via iframe

# 7. Current Architecture

Client -> Next.js App Router -> API Routes -> MongoDB or mock data

The app currently serves:
- / for the landing experience
- /nfc/[id] for the cartridge validation flow
- /play/[slug] for the game launch page
- /admin for game and cartridge administration
- /api/* for data and validation endpoints

ROM files are routed through the app API layer rather than exposed directly.

# 8. Security and Session Notes

Current MVP scope:
- NFC validation happens through a dedicated API endpoint.
- Admin access is protected by a session-based flow.
- The app uses mock data fallback when MongoDB is not configured.
- Local admin access defaults to `admin` / `admin123` unless custom credentials are provided through environment variables.

Future enhancements:
- Stronger cartridge and session protections.
- More granular admin authorization rules.
- Short-lived launch tokens.
- Replay protection and audit logging.

# 9. Data Model

Games:
- id, title, console, slug, description, image, romPath, active

Cartridges:
- id, nfcId, gameId, collectionNumber, status

Users:
- id, profile, saves, achievements, library

Sessions:
- id, cartridgeId, expiresAt, device, active

# 10. Current Folder Structure

- app/
- components/
- lib/
- models/
- public/
- scripts/

# 11. Current API Surface

- POST /api/nfc/validate
- GET /api/game/[id]
- GET /api/rom/[slug]
- GET /api/rooms
- GET /api/rooms/[slug]
- GET /api/admin/games
- POST /api/admin/games
- PUT /api/admin/games/[id]
- DELETE /api/admin/games/[id]
- GET /api/admin/cartridges
- POST /api/admin/cartridges
- PUT /api/admin/cartridges/[id]
- DELETE /api/admin/cartridges/[id]

# 12. UX Direction

- Retro-inspired interface.
- Embedded emulator experience with a clean shell.
- Smooth loading states between validation and gameplay.
- Responsive and lightweight layout.

# 13. Hardware and Physical Context

Phase 1:
- NFC-style cartridge experience
- Browser-based launch flow

Phase 2:
- Stronger physical validation flow
- Better authentication and anti-replay protection

# 14. Roadmap

Current focus:
- Stabilize the MVP flow end to end.
- Improve admin UX and content management.
- Strengthen authentication and session handling.
- Continue refining feedback and validation in the admin CRUD experience.

Progress update (2026-07-06):

- Cloudflare R2 integration implemented and validated for write access after granting an API token proper object-write permission.
- Admin upload/edit flows confirmed working in development: creating/updating a game with a ROM file stores the ROM and saves `romPath` on the game record.
- Emulator boot flow improved: EmulatorJS now auto-starts loaded games and arcade/retro metadata maps to the correct `arcade` core.

Next steps:
- Cloud saves and profiles.
- Better ROM storage and delivery.
- Marketplace and collection-oriented features.

# 15. Decision Log

- 2026-07-06: MVP implemented with App Router, API routes, mock-data fallback, and embedded emulator flow.
- 2026-07-06: Development server currently runs on port 3001.
- 2026-07-06: MongoDB is optional; local development works without it.
- 2026-07-06: Rooms now use a Cloudflare R2-aware storage adapter when configured, with mock-data fallback otherwise.

# 16. Documentation Rule

This document is the source of truth for the product direction. Any new feature, route, API, or UX change should be reflected here.
