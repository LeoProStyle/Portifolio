import type { NextAuthConfig } from 'next-auth';
import { ADMIN_SESSION_MAX_AGE_SECONDS, isAdminSessionExpired } from '@/lib/admin-session';

// Edge-safe configuration shared by middleware.ts and auth.ts.
// Import only edge-safe modules with no imports of their own (lib/admin-session.ts); never
// node:crypto, mongodb or lib/auth-config: middleware runs on the edge runtime and loads this file.
// secret, session options and the callbacks live only here; auth.ts must not override them.

// Same rule as isProductionEnv in lib/auth-config.ts (not imported: this file must stay edge-safe):
// only development and test get the dev secret; any other NODE_ENV, or none, fails closed.
const isProduction = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';

export const authConfig = {
  trustHost: true,
  // Production without AUTH_SECRET gets no secret: NextAuth refuses (MissingSecret) and the
  // admin guard answers 401. The literal fallback exists only outside production (SF02 RN01).
  secret: process.env.AUTH_SECRET || (isProduction ? undefined : 'retrokey-dev-secret'),
  session: { strategy: 'jwt', maxAge: ADMIN_SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: '/login'
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (user) {
        token.role = 'admin';
        token.loginAt = nowSeconds;
        return token;
      }
      // NextAuth renews exp on every session read; loginAt keeps the 8h limit absolute.
      // Returning null makes NextAuth drop the session cookie.
      if (isAdminSessionExpired(token.loginAt, nowSeconds)) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        session.user.role = token.role;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
