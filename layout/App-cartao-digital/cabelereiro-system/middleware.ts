import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Pega a string de emails e converte em um array
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your middleware
export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/", "/sign-in", "/sign-up"],
  
  // Routes that can always be accessed, and have no authentication information
  ignoredRoutes: [
    "/api/webhooks(.*)",
    "/_next/static/(.*)",
    "/favicon.ico"
  ],
  async afterAuth(auth, req) {
    // Se não está autenticado e tenta acessar rota protegida
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Se está autenticado, verifica permissões
    if (auth.userId) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);

        // Protege rotas administrativas
        if (req.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
          return NextResponse.redirect(new URL('/client', req.url));
        }

        // Redireciona admin para área administrativa
        if (req.nextUrl.pathname.startsWith('/client') && isAdmin) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }

        // Redireciona da home page
        if (req.nextUrl.pathname === '/') {
          return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/client', req.url));
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
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