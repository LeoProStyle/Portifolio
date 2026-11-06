import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession['user'];
  }
}

// next-auth/jwt re-exports this module; the JWT interface is declared here.
declare module '@auth/core/jwt' {
  interface JWT {
    role?: string;
    /** Seconds since epoch of the sign-in; the 8h session limit is measured from it. */
    loginAt?: number;
  }
}
