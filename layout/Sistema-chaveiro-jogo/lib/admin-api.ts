export type AdminAuthStatus = 401 | 403;

export type AdminAuthErrorBody = { error: 'Unauthorized' } | { error: 'Forbidden' };

export type AdminApiErrorBody = { error?: string };

// STUB (tasks.md T02): value and body are filled in by tasks.md T09.
export const ADMIN_LOGIN_URL: string = '';

export function getAdminAuthStatus(response: Response): AdminAuthStatus | null {
  void response;
  throw new Error('not implemented');
}
