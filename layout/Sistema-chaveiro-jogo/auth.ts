import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { authorizeAdmin } from '@/lib/admin-login';

// Node-only: the Credentials provider. secret, session and callbacks come from auth.config.ts.
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      authorize(credentials, request) {
        return authorizeAdmin(credentials ?? {}, request);
      }
    })
  ]
});
