export type RomLocation =
  | { kind: 'r2'; key: string }
  | { kind: 'local'; absolutePath: string }
  | { kind: 'rejected'; reason: 'empty' | 'format' | 'outside-roms' };

export function classifyRomPath(_romPath: unknown, _publicDir?: string): RomLocation {
  throw new Error('classifyRomPath not implemented');
}

export function romPathForCreate(_uploaded: string | undefined): string {
  throw new Error('romPathForCreate not implemented');
}

export function romPathForUpdate(_uploaded: string | undefined): { romPath?: string } {
  throw new Error('romPathForUpdate not implemented');
}
