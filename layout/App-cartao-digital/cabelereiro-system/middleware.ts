import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Pega a string de emails e converte em um array
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());

// Lista de rotas públicas que não precisam de autenticação
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/api/webhooks(.*)",
  "/_next/static/(.*)",
  "/favicon.ico",
  "/(.*).png",
  "/(.*).jpg",
  "/(.*).jpeg",
  "/(.*).gif",
  "/(.*).ico"
];

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
    // Se não está autenticado e tenta acessar rota protegida
    if (!auth.userId && !auth.isPublicRoute) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Se está autenticado, verifica permissões apenas para rotas protegidas
    if (auth.userId && !auth.isPublicRoute) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);

        const path = req.nextUrl.pathname;

        // Verifica apenas se está tentando acessar uma área não permitida
        if (path.startsWith('/admin') && !isAdmin) {
          return NextResponse.redirect(new URL('/client', req.url));
        }

        if (path.startsWith('/client') && isAdmin) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }

        // Redireciona da home page apenas se necessário
        if (path === '/') {
          return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/client', req.url));
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        return NextResponse.next();
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