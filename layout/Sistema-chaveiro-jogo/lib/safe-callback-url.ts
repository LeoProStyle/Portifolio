// Import-free, client-safe: where the login page may send the admin after a successful sign-in.

export const DEFAULT_CALLBACK_URL = '/admin';

/**
 * Returns a same-origin path (pathname + search + hash) or DEFAULT_CALLBACK_URL.
 * The value is resolved by the URL parser itself, so tricks the parser normalizes away
 * ('//host', '/\host', '/<TAB>/host', 'http://host') are judged by the origin they really reach.
 */
export function safeCallbackUrl(value: string | null, origin: string): string {
  if (!value || !value.startsWith('/')) return DEFAULT_CALLBACK_URL;
  let resolved: URL;
  try {
    resolved = new URL(value, origin);
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
  if (resolved.origin !== new URL(origin).origin) return DEFAULT_CALLBACK_URL;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
