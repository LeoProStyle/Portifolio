import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Rotas públicas que não requerem autenticação
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/api/webhooks(.*)",
  "/_next(.*)",
  "/favicon.ico",
];

async function isAdmin(userId) {
  try {
    if (!userId) {
      console.log('[Auth Debug] isAdmin - userId não fornecido');
      return false;
    }
    
    const user = await clerkClient.users.getUser(userId);
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      console.log('[Auth Debug] isAdmin - Email não encontrado para o usuário');
      return false;
    }

    const userEmail = user.emailAddresses[0].emailAddress;
    console.log('[Auth Debug] isAdmin - Verificação:', {
      userEmail,
      isAdmin: userEmail === "leoprostyle@gmail.com"
    });

    return userEmail === "leoprostyle@gmail.com";
  } catch (error) {
    console.error('[Auth Debug] isAdmin - Erro:', error);
    return false;
  }
}

export default authMiddleware({
  publicRoutes,
  
  async afterAuth(auth, req) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log('[Auth Debug] Middleware - Início:', {
      path,
      isAuthenticated: !!auth.userId,
      isPublicRoute: publicRoutes.includes(path)
    });

    // Se já estiver autenticado e tentar acessar páginas de auth, redireciona
    if (auth.userId && (path === '/sign-in' || path === '/sign-up')) {
      const adminStatus = await isAdmin(auth.userId);
      const redirectUrl = new URL(adminStatus ? '/admin' : '/client', req.url);
      console.log('[Auth Debug] Middleware - Redirecionando usuário autenticado:', {
        de: path,
        para: redirectUrl.pathname,
        isAdmin: adminStatus
      });
      return NextResponse.redirect(redirectUrl);
    }

    // Permite acesso a rotas públicas
    if (publicRoutes.includes(path)) {
      console.log('[Auth Debug] Middleware - Permitindo acesso a rota pública:', path);
      return NextResponse.next();
    }

    // Redireciona usuários não autenticados para login
    if (!auth.userId) {
      const signInUrl = new URL('/sign-in', req.url);
      console.log('[Auth Debug] Middleware - Redirecionando para login:', {
        de: path,
        para: signInUrl.pathname
      });
      return NextResponse.redirect(signInUrl);
    }

    try {
      const adminStatus = await isAdmin(auth.userId);
      console.log('[Auth Debug] Middleware - Verificação de permissão:', {
        path,
        isAdmin: adminStatus
      });

      // Redireciona com base no tipo de usuário
      if (path === '/') {
        const redirectUrl = new URL(adminStatus ? '/admin' : '/client', req.url);
        console.log('[Auth Debug] Middleware - Redirecionando da raiz:', {
          para: redirectUrl.pathname,
          isAdmin: adminStatus
        });
        return NextResponse.redirect(redirectUrl);
      }

      // Proteção de rotas por tipo de usuário
      if (adminStatus && path.startsWith('/client')) {
        console.log('[Auth Debug] Middleware - Admin tentando acessar área de cliente, redirecionando para /admin');
        return NextResponse.redirect(new URL('/admin', req.url));
      }

      if (!adminStatus && path.startsWith('/admin')) {
        console.log('[Auth Debug] Middleware - Cliente tentando acessar área admin, redirecionando para /client');
        return NextResponse.redirect(new URL('/client', req.url));
      }

      console.log('[Auth Debug] Middleware - Acesso permitido:', path);
      return NextResponse.next();
    } catch (error) {
      console.error('[Auth Debug] Middleware - Erro:', error);
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}; 