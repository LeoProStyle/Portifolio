import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Pega a string de emails e converte em um array
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());

// Lista de rotas públicas que não precisam de autenticação
const publicRoutes = ["/", "/sign-in", "/sign-up"];

// Lista de rotas que devem ser ignoradas pelo middleware
const ignoredRoutes = [
  "/api/webhooks(.*)",
  "/_next/static/(.*)",
  "/favicon.ico",
  "/(.*).png",
  "/(.*).jpg",
  "/(.*).jpeg",
  "/(.*).gif",
  "/(.*).ico"
];

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your middleware
export default authMiddleware({
  publicRoutes,
  ignoredRoutes,

  async afterAuth(auth, req) {
    const isAuthPage = req.nextUrl.pathname === '/sign-in' || req.nextUrl.pathname === '/sign-up';

    // Se está autenticado e tentando acessar páginas de auth
    if (auth.userId && isAuthPage) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/client', req.url));
      } catch (error) {
        return NextResponse.redirect(new URL('/client', req.url));
      }
    }

    // Se não está autenticado e tenta acessar rota protegida
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Se está autenticado, verifica permissões para rotas protegidas
    if (auth.userId && !isAuthPage) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);

        // Redireciona com base nas permissões
        if (req.nextUrl.pathname === '/') {
          return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/client', req.url));
        }

        if (req.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
          return NextResponse.redirect(new URL('/client', req.url));
        }

        if (req.nextUrl.pathname.startsWith('/client') && isAdmin) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      } catch (error) {
        return NextResponse.redirect(new URL('/client', req.url));
      }
    }

    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ],
}; 