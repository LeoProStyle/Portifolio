import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Rotas públicas que não requerem autenticação
const publicRoutes = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/_next(.*)",
  "/favicon.ico",
  "/clerk(.*)",
  "/assets(.*)"
];

async function isAdmin(userId) {
  try {
    if (!userId) return false;
    
    const user = await clerkClient.users.getUser(userId);
    if (!user?.emailAddresses?.[0]?.emailAddress) return false;

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
    return adminEmails.includes(user.emailAddresses[0].emailAddress);
  } catch (error) {
    console.error('[Auth Debug] isAdmin - Erro:', error);
    return false;
  }
}

export default authMiddleware({
  publicRoutes,
  debug: true,
  
  async afterAuth(auth, req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Debug para ambiente Vercel
    console.log('[Vercel Debug] Request:', {
      path,
      isAuth: !!auth.userId,
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      session: auth.sessionId ? 'presente' : 'ausente'
    });

    // Se não estiver autenticado e tentar acessar rota protegida
    if (!auth.userId && !publicRoutes.some(route => 
      route.endsWith("(.*)") 
        ? path.startsWith(route.slice(0, -4))
        : path === route
    )) {
      if (path === '/sign-in' || path === '/sign-up') {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Se estiver autenticado
    if (auth.userId) {
      const adminStatus = await isAdmin(auth.userId);
      const userPath = adminStatus ? '/admin' : '/client';

      // Se tentar acessar sign-in/sign-up quando já autenticado
      if (path === '/sign-in' || path === '/sign-up' || path === '/') {
        return NextResponse.redirect(new URL(userPath, req.url));
      }

      // Proteção de rotas por tipo de usuário
      if (adminStatus && path.startsWith('/client')) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }

      if (!adminStatus && path.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/client', req.url));
      }
    }

    return NextResponse.next();
  }
});

// Configuração do matcher para incluir todas as rotas necessárias
export const config = {
  matcher: [
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
    '/api/(.*)',
  ],
}; 