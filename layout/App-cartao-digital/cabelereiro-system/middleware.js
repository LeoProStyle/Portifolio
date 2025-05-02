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

    const userEmail = user.emailAddresses[0].emailAddress;
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
      .map(e => e.trim())
      .filter(Boolean);

    return adminEmails.includes(userEmail);
  } catch (error) {
    console.error('[Auth] Erro ao verificar admin:', error);
    return false;
  }
}

export default authMiddleware({
  publicRoutes,
  
  async afterAuth(auth, req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Se já estiver autenticado e tentar acessar páginas de auth, redireciona
    if (auth.userId && (path === '/sign-in' || path === '/sign-up')) {
      const adminStatus = await isAdmin(auth.userId);
      return NextResponse.redirect(new URL(adminStatus ? '/admin' : '/client', req.url));
    }

    // Permite acesso a rotas públicas
    if (publicRoutes.includes(path)) {
      return NextResponse.next();
    }

    // Redireciona usuários não autenticados para login
    if (!auth.userId) {
      const signInUrl = new URL('/sign-in', req.url);
      return NextResponse.redirect(signInUrl);
    }

    try {
      const adminStatus = await isAdmin(auth.userId);

      // Redireciona com base no tipo de usuário
      if (path === '/') {
        return NextResponse.redirect(new URL(adminStatus ? '/admin' : '/client', req.url));
      }

      // Proteção de rotas por tipo de usuário
      if (adminStatus && path.startsWith('/client')) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }

      if (!adminStatus && path.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/client', req.url));
      }

      return NextResponse.next();
    } catch (error) {
      console.error('[Auth] Erro no middleware:', error);
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ]
}; 