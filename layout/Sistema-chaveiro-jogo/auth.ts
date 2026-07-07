import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { logAuthEvent, resolveAdminCredentials } from '@/lib/auth-config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || 'retrokey-dev-secret',
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const expected = resolveAdminCredentials();
        const username = credentials?.username;
        const password = credentials?.password;

        const isValid = username === expected.username && password === expected.password;

        if (isValid) {
          logAuthEvent('admin login success', { username });
          return {
            id: 'admin',
            name: 'Admin',
            email: 'admin@retrokey.local'
          };
        }

        logAuthEvent('admin login rejected', { username, expectedUsername: expected.username });
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & { role?: string };
        sessionUser.role = token.role as string;
      }
      return session;
    }
  }
});
