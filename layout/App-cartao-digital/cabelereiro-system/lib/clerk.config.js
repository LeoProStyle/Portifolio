export const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());

export const PUBLIC_ROUTES = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/_next/static/(.*)",
  "/favicon.ico",
  "/(.*).png",
  "/(.*).jpg",
  "/(.*).jpeg",
  "/(.*).gif",
  "/(.*).ico",
  "/sso-callback(.*)",
  "/.well-known(.*)",
  "/oauth(.*)",
  "/verify(.*)",
  "/api/auth/(.*)"
];

export const CLERK_CONFIG = {
  signIn: {
    redirectUrl: '/client',
    firstFactorVerification: {
      strategy: 'code',
    },
    oauth: {
      providers: ['google'],
      timeout: 10000
    }
  },
  signUp: {
    redirectUrl: '/client',
  },
  afterSignIn: () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  },
};

export const isAdmin = (email) => {
  return ADMIN_EMAILS.includes(email);
}; 