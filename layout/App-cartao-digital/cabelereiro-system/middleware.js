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
    if (!userId) return false;
    
    const user = await clerkClient.users.getUser(userId);
    if (!user?.emailAddresses?.[0]?.emailAddress) return false;

    return user.emailAddresses[0].emailAddress === "leoprostyle@gmail.com";
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

    // Se não estiver autenticado e tentar acessar rota protegida
    if (!auth.userId && !publicRoutes.includes(path)) {
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

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}; 