import path from 'node:path';

export type RomLocation =
  | { kind: 'r2'; key: string }
  | { kind: 'local'; absolutePath: string }
  | { kind: 'rejected'; reason: 'empty' | 'format' | 'outside-roms' };

/** The exact key shape `buildRomObjectKey` (lib/r2.ts) produces. */
export const R2_ROM_KEY = /^roms\/[a-z0-9-]+\.[a-z0-9]+$/;

const LOCAL_PREFIX = '/roms/';

/**
 * Decides how a stored `romPath` may be read.
 * - `roms/<slug>.<ext>` in the builder format → R2 key.
 * - `/roms/<name>` → file under `<publicDir>/roms`, accepted only when the resolved path stays inside it.
 * - Anything else → rejected. `%` sequences are not decoded: they stay part of a literal file name.
 */
export function classifyRomPath(romPath: unknown, publicDir?: string): RomLocation {
  if (typeof romPath !== 'string' || romPath === '') {
    return { kind: 'rejected', reason: 'empty' };
  }
  if (romPath.includes('\0') || romPath.includes('\\')) {
    return { kind: 'rejected', reason: 'format' };
  }
  if (R2_ROM_KEY.test(romPath)) {
    return { kind: 'r2', key: romPath };
  }
  if (romPath.startsWith(LOCAL_PREFIX)) {
    const romsDir = path.resolve(publicDir ?? path.join(process.cwd(), 'public'), 'roms');
    const absolutePath = path.resolve(romsDir, '.' + romPath.slice('/roms'.length));
    if (absolutePath.startsWith(romsDir + path.sep)) {
      return { kind: 'local', absolutePath };
    }
    return { kind: 'rejected', reason: 'outside-roms' };
  }
  return { kind: 'rejected', reason: 'format' };
}

/** The romPath a new game stores: the upload's path, or '' without a file. Never the request body. */
export function romPathForCreate(uploaded: string | undefined): string {
  return uploaded ?? '';
}

/** The romPath fields an edit sets: only when a file was uploaded, so an edit without a file keeps the stored value. */
export function romPathForUpdate(uploaded: string | undefined): { romPath?: string } {
  return uploaded === undefined ? {} : { romPath: uploaded };
}
