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

type SystemMatch = { system: EmulatorSystem; legacyLabel?: string };

// Ordered alias rules. The order matters: 'snes' must win over 'nes', 'gba'/'gbc' over 'game boy'.
const legacySystemRules: { test: (normalized: string) => boolean; system: EmulatorSystem; label: string }[] = [
  { test: (n) => n.includes('arcade') || n.includes('fbneo'), system: 'Arcade (FBNeo)', label: 'arcade' },
  { test: (n) => n.includes('mega') || n.includes('genesis') || n.includes('drive'), system: 'Mega Drive / Genesis', label: 'Genesis/Mega Drive' },
  { test: (n) => n.includes('nintendo 64') || n.includes('n64'), system: 'Nintendo 64', label: 'Nintendo 64' },
  { test: (n) => n.includes('game boy advance') || n.includes('gba'), system: 'Game Boy Advance', label: 'GBA' },
  { test: (n) => n.includes('game boy color') || n.includes('gbc'), system: 'Game Boy Color', label: 'Game Boy Color' },
  { test: (n) => n.includes('game boy') || n === 'gb', system: 'Game Boy', label: 'Game Boy' },
  { test: (n) => n.includes('snes') || n.includes('super nintendo') || n.includes('sfc'), system: 'SNES', label: 'SNES' },
  { test: (n) => n.includes('nes'), system: 'NES', label: 'NES' },
  { test: (n) => n.includes('playstation') || n.includes('psx'), system: 'PlayStation', label: 'PlayStation' },
  { test: (n) => n.includes('neo geo'), system: 'Neo Geo', label: 'Neo Geo' }
];

function matchEmulatorSystem(normalized: string): SystemMatch | null {
  if (!normalized) return null;

  const exactMatch = (Object.keys(systemToCoreMap) as EmulatorSystem[]).find(
    (key) => key.toLowerCase() === normalized
  );
  if (exactMatch) return { system: exactMatch };

  const rule = legacySystemRules.find((candidate) => candidate.test(normalized));
  return rule ? { system: rule.system, legacyLabel: rule.label } : null;
}

// Maps a stored system or console name (exact or legacy alias) to the EmulatorSystem it means.
// Returns null for an empty or unknown value. Pure: no logging.
export function resolveEmulatorSystem(system?: string | null): EmulatorSystem | null {
  return matchEmulatorSystem(normalizeSystemValue(system))?.system ?? null;
}

export function getCoreForSystem(system?: string | null): string {
  const normalized = normalizeSystemValue(system);

  if (!normalized) {
    console.warn('[emulator cores] No system selected, defaulting to', defaultEmulatorCore);
    return defaultEmulatorCore;
  }

  const match = matchEmulatorSystem(normalized);

  if (!match) {
    console.warn('[emulator cores] Unknown system selected, falling back to default core', {
      system,
      fallback: defaultEmulatorCore
    });
    return defaultEmulatorCore;
  }

  const core = systemToCoreMap[match.system] ?? defaultEmulatorCore;
  if (match.legacyLabel) {
    console.info(`[emulator cores] Legacy ${match.legacyLabel} system detected, using ${core}`, { system });
  }
  return core;
}
