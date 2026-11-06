export interface AdminCredentials {
  username: string;
  password: string;
}

// The env parameters are accepted but not read yet: tasks.md T08 rewrites this module.
export function resolveAdminCredentials(_env: NodeJS.ProcessEnv = process.env): AdminCredentials {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  return { username, password };
}

export function isUsingDefaultAdminCredentials(): boolean {
  return !process.env.ADMIN_USERNAME && !process.env.ADMIN_PASSWORD;
}

export function isProductionEnv(_env: NodeJS.ProcessEnv = process.env): boolean {
  throw new Error('isProductionEnv not implemented (tasks.md T08)');
}

export function getAdminLoginHint(_env: NodeJS.ProcessEnv = process.env): string {
  if (isUsingDefaultAdminCredentials()) {
    return 'Modo desenvolvimento: use admin / admin123';
  }

  return 'Use as credenciais configuradas em .env.local.';
}

export function logAuthEvent(message: string, details?: Record<string, unknown>) {
  console.info(`[auth] ${message}`, details ?? {});
}
