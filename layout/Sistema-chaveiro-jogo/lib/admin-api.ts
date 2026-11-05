// Client-safe helpers for the admin API (no server imports: also loaded by middleware on the edge).

export type AdminAuthStatus = 401 | 403;

export type AdminAuthErrorBody = { error: 'Unauthorized' } | { error: 'Forbidden' };

export type AdminApiErrorBody = { error?: string };

/** The only place the admin login URL is written. */
export const ADMIN_LOGIN_URL = '/login?callbackUrl=/admin';

/** Returns 401/403 when the admin API refused the session; null for any other status. Decides by status, never by body text. */
export function getAdminAuthStatus(response: Response): AdminAuthStatus | null {
  if (response.status === 401 || response.status === 403) {
    return response.status;
  }
  return null;
}
