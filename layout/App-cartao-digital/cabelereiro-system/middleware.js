import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { PUBLIC_ROUTES, isAdmin } from "./lib/clerk.config";

export default authMiddleware({
  publicRoutes: PUBLIC_ROUTES,
  debug: process.env.NODE_ENV === 'development',

  async afterAuth(auth, req) {
    const path = req.nextUrl.pathname;
    
    // Log da requisição
    console.log('Middleware - Request:', { 
      path, 
      isAuthenticated: !!auth.userId,
      isPublicRoute: auth.isPublicRoute,
      hasSession: !!auth.sessionId
    });

    // Permite rotas de autenticação e OAuth
    if (path.match(/\/(sign-in|sign-up|sso-callback|oauth|verify|api\/auth)/)) {
      console.log('Middleware - Permitindo rota de autenticação:', path);
      return NextResponse.next();
    }

    // Redireciona para login se não estiver autenticado
    if (!auth.userId && !auth.isPublicRoute) {
      console.log('Middleware - Usuário não autenticado, redirecionando para login');
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', path);
      return NextResponse.redirect(signInUrl);
    }

    // Verifica permissões para rotas protegidas
    if (auth.userId && (path.startsWith('/admin') || path.startsWith('/client'))) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;

        if (!userEmail) {
          console.error('Middleware - Email não encontrado para usuário:', auth.userId);
          return NextResponse.redirect(new URL('/client', req.url));
        }

        const adminStatus = isAdmin(userEmail);
        console.log('Middleware - Verificação:', { 
          path, 
          userEmail, 
          isAdmin: adminStatus,
          sessionId: auth.sessionId 
        });

        if (path.startsWith('/admin') && !adminStatus) {
          return NextResponse.redirect(new URL('/client', req.url));
        }

        if (path.startsWith('/client') && adminStatus) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      } catch (error) {
        console.error('Middleware - Erro ao verificar usuário:', error);
        return NextResponse.redirect(new URL('/client', req.url));
      }
    }

    return NextResponse.next();
  }
});

// Configuração do matcher para o middleware
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ]
}; 