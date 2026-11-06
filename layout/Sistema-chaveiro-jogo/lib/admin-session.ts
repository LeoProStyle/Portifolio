// Edge-safe, import-free: auth.config.ts (middleware, edge runtime) imports this module.

/** The admin session ends 8 hours after login, however often it is used (SF02 RF05). */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** A token without loginAt, or older than the limit, is expired. */
export function isAdminSessionExpired(loginAt: number | undefined, nowSeconds: number): boolean {
  if (typeof loginAt !== 'number' || !Number.isFinite(loginAt)) return true;
  return nowSeconds - loginAt >= ADMIN_SESSION_MAX_AGE_SECONDS;
}
