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
    // Debug completo do objeto auth
    console.log('Auth object:', JSON.stringify({
      userId: auth.userId,
      isPublicRoute: auth.isPublicRoute,
      sessionClaims: auth.sessionClaims,
      sessionId: auth.sessionId
    }, null, 2));

    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Se o usuário está autenticado
    if (auth.userId) {
      try {
        // Buscar informações do usuário usando clerkClient
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        
        console.log('Informações do usuário:', {
          userId: user.id,
          userEmail,
          ADMIN_EMAILS
        });
        
        // Verifica se o email do usuário está na lista de admins
        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        console.log('É admin?', isAdmin);

        // Se estiver tentando acessar a página inicial, redireciona baseado no email
        if (req.nextUrl.pathname === '/') {
          if (isAdmin) {
            console.log('Redirecionando admin para /admin');
            return NextResponse.redirect(new URL('/admin', req.url));
          } else {
            console.log('Redirecionando usuário para /client');
            return NextResponse.redirect(new URL('/client', req.url));
          }
        }

        // Protege a rota admin
        if (req.nextUrl.pathname.startsWith('/admin')) {
          if (!isAdmin) {
            console.log('Usuário não admin tentando acessar /admin');
            return NextResponse.redirect(new URL('/client', req.url));
          }
        }

        // Protege a rota client para usuários autenticados
        if (req.nextUrl.pathname.startsWith('/client')) {
          if (isAdmin) {
            console.log('Admin tentando acessar /client');
            return NextResponse.redirect(new URL('/admin', req.url));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);
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