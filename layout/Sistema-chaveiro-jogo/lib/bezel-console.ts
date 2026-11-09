import { FRAME_STYLES, type FrameStyle } from '@/lib/play-theme';

// Console bezels (0002F SF04). Pure module: no fs, no SDK, no database, so client components
// can import it. lib/bezel.ts (server) and the admin Bezels tab both read the rules from here.

export type BezelConsoleId = Exclude<FrameStyle, 'neutral'>;

// Closed list of console ids: FRAME_STYLES minus 'neutral', in FRAME_STYLES order (RF02).
export const BEZEL_CONSOLE_IDS: readonly BezelConsoleId[] = FRAME_STYLES.filter(
  (style): style is BezelConsoleId => style !== 'neutral'
);

// Exact, case-sensitive membership; any non-string is refused (RN02).
export function isBezelConsoleId(value: unknown): value is BezelConsoleId {
  return typeof value === 'string' && (BEZEL_CONSOLE_IDS as readonly string[]).includes(value);
}

// The R2 key comes only from the console id; the uploaded file name is never used (RN02).
export function bezelObjectKey(id: BezelConsoleId): string {
  return `bezels/${id}.png`;
}

export const BEZEL_MAX_BYTES = 2097152;
// Upper bound for the whole multipart request: file limit plus 64 KB for form overhead.
export const BEZEL_MAX_REQUEST_BYTES = BEZEL_MAX_BYTES + 65536;

export const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// True only when the first 8 bytes equal the PNG signature.
export function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export const BEZEL_ASPECT_TOLERANCE = 0.02;

// True when the image ratio differs from 16:9 by more than the tolerance (RN06 warning).
export function isBezelAspectOff(width: number, height: number): boolean {
  return Math.abs(width / height - 16 / 9) > BEZEL_ASPECT_TOLERANCE;
}
