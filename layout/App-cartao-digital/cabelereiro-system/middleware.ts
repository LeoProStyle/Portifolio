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
    console.log('Middleware - Iniciando afterAuth', {
      userId: auth.userId,
      path: req.nextUrl.pathname,
      isPublicRoute: auth.isPublicRoute
    });

    // Se não está autenticado e tenta acessar rota protegida
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Se está autenticado
    if (auth.userId) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        
        console.log('Middleware - Verificando acesso', {
          userEmail,
          isAdmin,
          path: req.nextUrl.pathname
        });

        // Redirecionamentos baseados no tipo de usuário
        let shouldRedirect = false;
        let targetPath = '';

        if (req.nextUrl.pathname === '/') {
          shouldRedirect = true;
          targetPath = isAdmin ? '/admin' : '/client';
        } else if (req.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
          shouldRedirect = true;
          targetPath = '/client';
        } else if (req.nextUrl.pathname.startsWith('/client') && isAdmin) {
          shouldRedirect = true;
          targetPath = '/admin';
        } else if (req.nextUrl.pathname === '/sign-in' || req.nextUrl.pathname === '/sign-up') {
          shouldRedirect = true;
          targetPath = isAdmin ? '/admin' : '/client';
        }

        if (shouldRedirect) {
          return NextResponse.redirect(new URL(targetPath, req.url));
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
      }
    }

    console.log('Middleware - Permitindo acesso:', req.nextUrl.pathname);
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