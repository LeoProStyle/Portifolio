import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { logAuthEvent, resolveAdminCredentials } from '@/lib/auth-config';
import { verifyPasswordHash, verifyPlainPassword } from '@/lib/password';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Bridge until tasks.md T13 hands this to lib/admin-login.ts (throttle and fail-closed logging).
        const expected = resolveAdminCredentials();
        if (!expected.ok) {
          console.error('[auth] login disabled', { reason: expected.reason });
          return null;
        }
        const username = typeof credentials?.username === 'string' ? credentials.username : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        const userMatches = verifyPlainPassword(username, expected.username);
        const passwordMatches =
          expected.secret.kind === 'hash'
            ? await verifyPasswordHash(password, expected.secret.value)
            : verifyPlainPassword(password, expected.secret.value);

        if (userMatches && passwordMatches) {
          logAuthEvent('admin login success', { id: 'admin' });
          return {
            id: 'admin',
            name: 'Admin',
            email: 'admin@retrokey.local'
          };
        }

        logAuthEvent('admin login failure', { username });
        return null;
      }
    })
  ]
});
