# ROM Setup Guide

## Local Development

### Step 1: Add ROMs to the public folder

Create a directory for ROMs:
```bash
mkdir -p public/roms
```

Place your ROM files there. For example:
- `public/roms/super-retro.bin` (NES)
- `public/roms/pixel-quest.nes` (NES)
- `public/roms/space-runner.smc` (SNES)

### Step 2: Update game metadata

When creating a game in the admin panel or via the API, set the `romPath` to match:
```json
{
  "title": "Super Retro",
  "console": "Arcade",
  "slug": "super-retro",
  "romPath": "/roms/super-retro.bin",
  "active": true
}
```

### Step 3: Play the game

Visit `/play/super-retro` and the emulator will:
1. Request the ROM from `/api/rom/super-retro`
2. Load it into EmulatorJS
3. Display in fullscreen iframe

## Production with Cloudflare R2

### Step 1: Create an R2 bucket

1. Log into Cloudflare dashboard
2. Navigate to R2 Storage
3. Create a new bucket: `retrokey-roms`
4. Generate API token with R2 permissions

### Step 2: Configure environment

Set in `.env.production`:
```env
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=retrokey-roms
R2_ACCOUNT_ID=your_account_id
```

### Step 3: Update ROM serving

Modify `/api/rom/[slug]/route.ts` to:
1. Check MongoDB for ROM metadata
2. Generate a signed URL from R2
3. Return the URL for EmulatorJS to load

Example pseudocode:
```typescript
const r2Url = await generateR2SignedUrl(game.romPath);
return NextResponse.json({ romUrl: r2Url });
```

## Supported Systems

EmulatorJS supports these cores out of the box:
- **NES** - core: `nes`
- **SNES** - core: `snes`
- **Genesis** - core: `genesis`
- **GameBoy** - core: `gb`
- **Arcade** - core: `arcade`

Update the `core` parameter in the Emulator component to match.

## Security Notes

- ROMs are never exposed directly via public URLs
- All ROM requests go through `/api/rom/{slug}`
- Consider adding authentication middleware to verify user sessions
- R2 URLs should be temporary signed URLs with expiration
