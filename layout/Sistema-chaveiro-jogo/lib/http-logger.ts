export function logRequest(method: string, url: string, details?: Record<string, unknown>) {
  console.info(`[http] ${method} ${url}`, details ?? {});
}

export function logError(message: string, details?: unknown) {
  console.error(`[error] ${message}`, details);
}
