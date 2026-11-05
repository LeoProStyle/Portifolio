import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';
import { ADMIN_LOGIN_URL } from '@/lib/admin-api';

// Redirects anonymous visitors of the /admin pages to the login page (RF03).
// It does not check the role: the /api/admin/* handlers are the security barrier (RN01).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_URL, req.nextUrl));
  }
  return NextResponse.next();
});

// Only the admin pages. /login, /api/auth/* and /api/* stay outside (RN02).
export const config = {
  matcher: ['/admin/:path*']
};
