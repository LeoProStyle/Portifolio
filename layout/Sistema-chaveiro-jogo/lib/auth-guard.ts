import type { Session } from 'next-auth';
import type { NextResponse } from 'next/server';

export type AdminIdentity = { id: string; name: string | null; email: string | null };

export type AdminGuardResult =
  | { ok: true; admin: AdminIdentity; session: Session }
  | { ok: false; response: NextResponse };

// STUB (tasks.md T01): bodies are filled in by tasks.md T06.
export function evaluateAdminSession(session: Session | null): AdminGuardResult {
  void session;
  throw new Error('not implemented');
}

export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  void request;
  throw new Error('not implemented');
}
