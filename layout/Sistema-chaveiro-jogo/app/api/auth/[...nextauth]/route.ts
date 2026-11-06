import type { NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { checkCredentialsLock } from '@/lib/admin-login';

export const GET = handlers.GET;

// The 429 for a locked username+IP key is answered here, before NextAuth: authorize can only
// return a user or null (SF02 RF03). Every other POST goes straight to NextAuth.
export async function POST(request: NextRequest) {
  const locked = await checkCredentialsLock(request);
  return locked ?? handlers.POST(request);
}
