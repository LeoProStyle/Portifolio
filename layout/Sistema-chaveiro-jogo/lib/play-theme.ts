import { resolveEmulatorSystem, type EmulatorSystem } from '@/lib/emulator-cores';

// Play-screen themes (0002F SF01). Pure module: no React, no database.
// Every value a theme carries is checked here, because the page turns it into inline CSS.
// SF03 (admin customization) reuses validatePlayTheme and ALLOWED_IMAGE_HOSTS.

export const FRAME_STYLES = [
  'nes',
  'snes',
  'n64',
  'dmg',
  'gbc',
  'gba',
  'sms',
  'megadrive',
  'gamegear',
  'ps',
  'arcade',
  'neogeo',
  'neutral'
] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

export const ASPECT_RATIOS = ['4/3', '10/9', '3/2'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// Fixed radius values from design.md Tokens; anything else is refused.
const FRAME_RADII = ['12px', '16px', '24px'] as const;

export type PlayTheme = {
  frame: FrameStyle;
  bg: string;
  accent: string;
  frameColor: string;
  ar: AspectRatio;
  radius: string;
  bgImage?: string;
};

// Values: design.md Tokens JSON (0002F SF01). Keys are the EmulatorSystem display names.
export const DEFAULT_PLAY_THEMES: Record<EmulatorSystem, PlayTheme> = {
  NES: { frame: 'nes', bg: '#1F1F23', accent: '#FF4D4D', frameColor: '#C9C9C9', ar: '4/3', radius: '12px' },
  SNES: { frame: 'snes', bg: '#2A2833', accent: '#B6A6FF', frameColor: '#D3D3DB', ar: '4/3', radius: '12px' },
  'Nintendo 64': { frame: 'n64', bg: '#141414', accent: '#3BB273', frameColor: '#3A3A3A', ar: '4/3', radius: '12px' },
  'Game Boy': { frame: 'dmg', bg: '#1E2A1E', accent: '#9BBC0F', frameColor: '#C4C0B4', ar: '10/9', radius: '24px' },
  'Game Boy Color': { frame: 'gbc', bg: '#1B1530', accent: '#FFD23F', frameColor: '#7A3FB0', ar: '10/9', radius: '24px' },
  'Game Boy Advance': { frame: 'gba', bg: '#15142B', accent: '#8F8FFF', frameColor: '#4B3FA6', ar: '3/2', radius: '24px' },
  'Master System': { frame: 'sms', bg: '#121212', accent: '#FF4545', frameColor: '#2B2B2B', ar: '4/3', radius: '12px' },
  'Mega Drive / Genesis': { frame: 'megadrive', bg: '#0D0D0D', accent: '#F2C14E', frameColor: '#1A1A1A', ar: '4/3', radius: '12px' },
  'Game Gear': { frame: 'gamegear', bg: '#111111', accent: '#4FA3FF', frameColor: '#2A2A2A', ar: '10/9', radius: '24px' },
  PlayStation: { frame: 'ps', bg: '#1C1C24', accent: '#7FB2FF', frameColor: '#B9B9BE', ar: '4/3', radius: '12px' },
  'Arcade (FBNeo)': { frame: 'arcade', bg: '#0B0B1A', accent: '#FF3EA5', frameColor: '#1F1F3A', ar: '4/3', radius: '12px' },
  'Neo Geo': { frame: 'neogeo', bg: '#0E0E0E', accent: '#E3B23C', frameColor: '#2C2C2C', ar: '4/3', radius: '12px' }
};

export const NEUTRAL_PLAY_THEME: PlayTheme = {
  frame: 'neutral',
  bg: '#09090B',
  accent: '#22D3EE',
  frameColor: '#27272A',
  ar: '4/3',
  radius: '16px'
};

// RN02: an image link is accepted only from these hosts, compared exactly in lowercase.
// Changing the list requires a deploy.
export const ALLOWED_IMAGE_HOSTS = ['i.imgur.com', 'upload.wikimedia.org', 'raw.githubusercontent.com'] as const;

const LIGHT_TEXT = '#F4F4F5';
const DARK_TEXT = '#18181B';
const MUTED_OPACITY = 0.72;
const MIN_CONTRAST = 4.5;

export function isHexColor(v: unknown): boolean {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function isFrameStyle(v: unknown): boolean {
  return typeof v === 'string' && (FRAME_STYLES as readonly string[]).includes(v);
}

function isAspectRatio(v: unknown): v is AspectRatio {
  return typeof v === 'string' && (ASPECT_RATIOS as readonly string[]).includes(v);
}

function isFrameRadius(v: unknown): v is string {
  return typeof v === 'string' && (FRAME_RADII as readonly string[]).includes(v);
}

export function isAllowedImageUrl(v: unknown): boolean {
  if (typeof v !== 'string' || !/^https:\/\//i.test(v)) return false;

  // The raw authority is checked before parsing: URL drops a default port such as ":443",
  // and RN02 refuses any explicit port, user or password.
  const rawAuthority = v.slice('https://'.length).split(/[/?#\\]/, 1)[0];
  if (!rawAuthority || /[@:\s]/.test(rawAuthority)) return false;

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;

  const host = rawAuthority.toLowerCase();
  return url.hostname === host && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(host);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2 contrast ratio between two #RRGGBB colors (1 to 21).
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function pickTextColor(bg: string): '#F4F4F5' | '#18181B' {
  return contrastRatio(LIGHT_TEXT, bg) >= contrastRatio(DARK_TEXT, bg) ? LIGHT_TEXT : DARK_TEXT;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Each invalid field falls back to the same field of `fallback`. When the result would put
// text or accent under 4.5:1 on its background, the whole fallback is returned instead.
export function validatePlayTheme(input: unknown, fallback: PlayTheme): PlayTheme {
  if (!isPlainObject(input)) return fallback;

  const theme: PlayTheme = {
    frame: isFrameStyle(input.frame) ? (input.frame as FrameStyle) : fallback.frame,
    bg: isHexColor(input.bg) ? (input.bg as string) : fallback.bg,
    accent: isHexColor(input.accent) ? (input.accent as string) : fallback.accent,
    frameColor: isHexColor(input.frameColor) ? (input.frameColor as string) : fallback.frameColor,
    ar: isAspectRatio(input.ar) ? input.ar : fallback.ar,
    radius: isFrameRadius(input.radius) ? input.radius : fallback.radius
  };

  const bgImage = isAllowedImageUrl(input.bgImage) ? (input.bgImage as string) : fallback.bgImage;
  if (bgImage !== undefined) theme.bgImage = bgImage;

  const readable =
    contrastRatio(pickTextColor(theme.bg), theme.bg) >= MIN_CONTRAST &&
    contrastRatio(theme.accent, theme.bg) >= MIN_CONTRAST;
  return readable ? theme : fallback;
}

// RN01/RN03: console default from code, else the neutral theme. Never reads a database.
export function resolvePlayTheme(system?: string | null, override?: unknown): PlayTheme {
  const resolved = resolveEmulatorSystem(system);
  const base = resolved ? DEFAULT_PLAY_THEMES[resolved] : NEUTRAL_PLAY_THEME;
  return override === undefined ? base : validatePlayTheme(override, base);
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Inline-style custom properties for the play stage. Never put these into the iframe URL.
export function playThemeCssVars(
  t: PlayTheme
): Record<'--t-bg' | '--t-accent' | '--t-frame' | '--t-text' | '--t-muted' | '--t-ar' | '--t-radius', string> {
  const text = pickTextColor(t.bg);
  return {
    '--t-bg': t.bg,
    '--t-accent': t.accent,
    '--t-frame': t.frameColor,
    '--t-text': text,
    '--t-muted': hexToRgba(text, MUTED_OPACITY),
    '--t-ar': t.ar.replace('/', ' / '),
    '--t-radius': t.radius
  };
}
