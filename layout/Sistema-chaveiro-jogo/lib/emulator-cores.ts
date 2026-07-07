export type EmulatorSystem =
  | 'NES'
  | 'SNES'
  | 'Nintendo 64'
  | 'Game Boy'
  | 'Game Boy Color'
  | 'Game Boy Advance'
  | 'Master System'
  | 'Mega Drive / Genesis'
  | 'Game Gear'
  | 'PlayStation'
  | 'Arcade (FBNeo)'
  | 'Neo Geo';

export const systemOptions: { value: EmulatorSystem; label: string }[] = [
  { value: 'NES', label: 'NES' },
  { value: 'SNES', label: 'SNES' },
  { value: 'Nintendo 64', label: 'Nintendo 64' },
  { value: 'Game Boy', label: 'Game Boy' },
  { value: 'Game Boy Color', label: 'Game Boy Color' },
  { value: 'Game Boy Advance', label: 'Game Boy Advance' },
  { value: 'Master System', label: 'Master System' },
  { value: 'Mega Drive / Genesis', label: 'Mega Drive / Genesis' },
  { value: 'Game Gear', label: 'Game Gear' },
  { value: 'PlayStation', label: 'PlayStation' },
  { value: 'Arcade (FBNeo)', label: 'Arcade (FBNeo)' },
  { value: 'Neo Geo', label: 'Neo Geo' }
];

export const systemToCoreMap: Record<EmulatorSystem, string> = {
  NES: 'fceumm',
  SNES: 'snes9x',
  'Nintendo 64': 'mupen64plus_next',
  'Game Boy': 'gambatte',
  'Game Boy Color': 'gambatte',
  'Game Boy Advance': 'mgba',
  'Master System': 'genesis_plus_gx',
  'Mega Drive / Genesis': 'genesis_plus_gx',
  'Game Gear': 'genesis_plus_gx',
  PlayStation: 'pcsx_rearmed',
  'Arcade (FBNeo)': 'fbneo',
  'Neo Geo': 'fbneo'
};

export const defaultEmulatorCore = 'fceumm';

function normalizeSystemValue(system?: string | null) {
  return (system || '').trim().toLowerCase();
}

export function getCoreForSystem(system?: string | null): string {
  const normalized = normalizeSystemValue(system);

  if (!normalized) {
    console.warn('[emulator cores] No system selected, defaulting to', defaultEmulatorCore);
    return defaultEmulatorCore;
  }

  const exactMatch = Object.entries(systemToCoreMap).find(
    ([key]) => key.toLowerCase() === normalized
  );

  if (exactMatch) {
    return exactMatch[1];
  }

  if (normalized.includes('arcade') || normalized.includes('fbneo')) {
    console.info('[emulator cores] Legacy arcade system detected, using fbneo', { system });
    return 'fbneo';
  }

  if (normalized.includes('mega') || normalized.includes('genesis') || normalized.includes('drive')) {
    console.info('[emulator cores] Legacy Genesis/Mega Drive system detected, using genesis_plus_gx', { system });
    return 'genesis_plus_gx';
  }

  if (normalized.includes('nintendo 64') || normalized.includes('n64')) {
    console.info('[emulator cores] Legacy Nintendo 64 system detected, using mupen64plus_next', { system });
    return 'mupen64plus_next';
  }

  if (normalized.includes('game boy advance') || normalized.includes('gba')) {
    console.info('[emulator cores] Legacy GBA system detected, using mgba', { system });
    return 'mgba';
  }

  if (normalized.includes('game boy color') || normalized.includes('gbc')) {
    console.info('[emulator cores] Legacy Game Boy Color system detected, using gambatte', { system });
    return 'gambatte';
  }

  if (normalized.includes('game boy') || normalized === 'gb') {
    console.info('[emulator cores] Legacy Game Boy system detected, using gambatte', { system });
    return 'gambatte';
  }

  if (normalized.includes('snes') || normalized.includes('super nintendo') || normalized.includes('sfc')) {
    console.info('[emulator cores] Legacy SNES system detected, using snes9x', { system });
    return 'snes9x';
  }

  if (normalized.includes('nes')) {
    console.info('[emulator cores] Legacy NES system detected, using fceumm', { system });
    return 'fceumm';
  }

  if (normalized.includes('playstation') || normalized.includes('psx')) {
    console.info('[emulator cores] Legacy PlayStation system detected, using pcsx_rearmed', { system });
    return 'pcsx_rearmed';
  }

  if (normalized.includes('neo geo')) {
    console.info('[emulator cores] Legacy Neo Geo system detected, using fbneo', { system });
    return 'fbneo';
  }

  console.warn('[emulator cores] Unknown system selected, falling back to default core', {
    system,
    fallback: defaultEmulatorCore
  });
  return defaultEmulatorCore;
}
