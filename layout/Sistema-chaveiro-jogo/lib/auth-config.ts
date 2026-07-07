export interface AdminCredentials {
  username: string;
  password: string;
}

export function resolveAdminCredentials(): AdminCredentials {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  return { username, password };
}

export function isUsingDefaultAdminCredentials(): boolean {
  return !process.env.ADMIN_USERNAME && !process.env.ADMIN_PASSWORD;
}

export function getAdminLoginHint(): string {
  if (isUsingDefaultAdminCredentials()) {
    return 'Modo desenvolvimento: use admin / admin123';
  }

  return 'Use as credenciais configuradas em .env.local.';
}

export function logAuthEvent(message: string, details?: Record<string, unknown>) {
  console.info(`[auth] ${message}`, details ?? {});
}
