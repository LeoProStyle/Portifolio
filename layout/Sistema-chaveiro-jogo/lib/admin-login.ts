// Stub: implemented in tasks.md T12.
import type { LoginAttemptStore } from '@/lib/login-throttle';

export type AdminUser = { id: 'admin'; name: 'Admin'; email: 'admin@retrokey.local' };

export type AdminLoginDeps = {
  env?: NodeJS.ProcessEnv;
  getStore?: () => Promise<LoginAttemptStore>;
  now?: () => Date;
  timeoutMs?: number;
};

export async function authorizeAdmin(
  _credentials: Partial<Record<string, unknown>>,
  _request: Request,
  _deps?: AdminLoginDeps
): Promise<AdminUser | null> {
  throw new Error('authorizeAdmin not implemented (tasks.md T12)');
}

export async function checkCredentialsLock(_request: Request, _deps?: AdminLoginDeps): Promise<Response | null> {
  throw new Error('checkCredentialsLock not implemented (tasks.md T12)');
}
