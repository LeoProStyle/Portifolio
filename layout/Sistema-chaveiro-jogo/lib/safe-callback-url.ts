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
  const ownOrigin = new URL(origin).origin;
  if (resolved.origin !== ownOrigin) return DEFAULT_CALLBACK_URL;
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  // The parser can normalize '/.//host' or '/a/..//host' into the path '//host', which the router then
  // reads as protocol-relative. Accept the result only if it is a plain path that resolves home again.
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return DEFAULT_CALLBACK_URL;
  if (new URL(path, origin).origin !== ownOrigin) return DEFAULT_CALLBACK_URL;
  return path;
}
