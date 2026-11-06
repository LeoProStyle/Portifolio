import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-config';

// Server-side barrier for /api/admin/* (RN01). No MongoDB import here: the session
// is decided from the signed JWT alone (RN03).

export type AdminIdentity = { id: string; name: string | null; email: string | null };

export type AdminGuardResult =
  | { ok: true; admin: AdminIdentity; session: Session }
  | { ok: false; response: NextResponse };

type RejectionReason = 'no-session' | 'not-admin' | 'auth-error';

function unauthorized(): AdminGuardResult {
  return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
}

function forbidden(): AdminGuardResult {
  return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

export function evaluateAdminSession(session: Session | null): AdminGuardResult {
  const user = session?.user;
  if (!session || !user) {
    return unauthorized();
  }
  if (user.role !== 'admin') {
    return forbidden();
  }
  if (!user.id) {
    // An admin session without an id cannot be attributed (SF03 audit); treat it as invalid.
    return unauthorized();
  }
  return {
    ok: true,
    admin: { id: user.id, name: user.name ?? null, email: user.email ?? null },
    session
  };
}

function logRejection(reason: RejectionReason, request: Request, errorName?: string) {
  let path = 'unknown';
  try {
    path = new URL(request.url).pathname;
  } catch {
    // keep 'unknown'
  }
  // Reason, path and (on auth-error) the error class name only: no body, cookie, token or message.
  logAuthEvent('admin api rejected', errorName ? { reason, path, error: errorName } : { reason, path });
}

export type SessionReader = () => Promise<Session | null>;

async function readSessionFromAuth(): Promise<Session | null> {
  // Loaded on demand so unit tests never load NextAuth.
  const { auth } = await import('@/auth');
  return auth();
}

export async function requireAdmin(
  request: Request,
  readSession: SessionReader = readSessionFromAuth
): Promise<AdminGuardResult> {
  let session: Session | null;
  try {
    session = await readSession();
  } catch (error) {
    logRejection('auth-error', request, error instanceof Error ? error.name : 'unknown');
    return unauthorized();
  }

  const result = evaluateAdminSession(session);
  if (!result.ok) {
    logRejection(result.response.status === 403 ? 'not-admin' : 'no-session', request);
  }
  return result;
}
