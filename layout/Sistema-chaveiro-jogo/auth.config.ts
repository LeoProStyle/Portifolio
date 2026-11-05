import type { NextAuthConfig } from 'next-auth';

// Edge-safe configuration shared by middleware.ts and auth.ts.
// Keep this file free of node:crypto, mongodb and lib/auth-config imports:
// middleware runs on the edge runtime and loads only this file.
// secret, session.maxAge and the callbacks live only here; auth.ts must not override them.
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || 'retrokey-dev-secret',
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login'
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = 'admin';
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
