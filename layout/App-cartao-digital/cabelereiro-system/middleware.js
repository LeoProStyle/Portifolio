import { authMiddleware, clerkClient } from "@clerk/nextjs";

// Rotas públicas que não requerem autenticação
const publicRoutes = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
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
  async afterAuth(auth, req) {
    // Sempre permitir requisições para rotas públicas
    if (publicRoutes.some(pattern => {
      if (pattern.endsWith("(.*)")) {
        return req.nextUrl.pathname.startsWith(pattern.slice(0, -4));
      }
      return req.nextUrl.pathname === pattern;
    })) {
      return;
    }

    // Se não estiver autenticado, redirecionar para login
    if (!auth.userId) {
      return Response.redirect(new URL("/sign-in", req.url));
    }

    // Se estiver autenticado, verificar permissões
    const adminStatus = await isAdmin(auth.userId);
    const path = req.nextUrl.pathname;

    // Redirecionar da raiz para a página apropriada
    if (path === '/') {
      const targetPath = adminStatus ? '/admin' : '/client';
      return Response.redirect(new URL(targetPath, req.url));
    }

    // Proteção de rotas administrativas
    if (path.startsWith('/admin') && !adminStatus) {
      return Response.redirect(new URL('/client', req.url));
    }

    // Proteção de rotas de cliente para admin
    if (path.startsWith('/client') && adminStatus) {
      return Response.redirect(new URL('/admin', req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}; 