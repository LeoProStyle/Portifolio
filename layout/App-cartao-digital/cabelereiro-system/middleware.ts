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
    const path = req.nextUrl.pathname;
    console.log('Middleware - Requisição recebida:', {
      path,
      isAuthenticated: !!auth.userId,
      isPublicRoute: auth.isPublicRoute
    });

    // Se não está autenticado e tenta acessar rota protegida
    if (!auth.userId && !auth.isPublicRoute) {
      console.log('Middleware - Redirecionando para login:', path);
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Se está autenticado, verifica permissões apenas para rotas protegidas
    if (auth.userId && !auth.isPublicRoute) {
      try {
        console.log('Middleware - Verificando permissões para:', path);
        
        const user = await clerkClient.users.getUser(auth.userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = ADMIN_EMAILS.includes(userEmail);

        console.log('Middleware - Dados do usuário:', {
          userEmail,
          isAdmin,
          currentPath: path
        });

        // Verifica apenas se está tentando acessar uma área não permitida
        if (path.startsWith('/admin') && !isAdmin) {
          console.log('Middleware - Usuário não autorizado tentando acessar admin');
          return NextResponse.redirect(new URL('/client', req.url));
        }

        if (path.startsWith('/client') && isAdmin) {
          console.log('Middleware - Admin tentando acessar área de cliente');
          return NextResponse.redirect(new URL('/admin', req.url));
        }

        // Redireciona da home page apenas se necessário
        if (path === '/') {
          const targetPath = isAdmin ? '/admin' : '/client';
          console.log('Middleware - Redirecionando da home para:', targetPath);
          return NextResponse.redirect(new URL(targetPath, req.url));
        }

        console.log('Middleware - Acesso permitido para:', path);
      } catch (error) {
        console.error('Middleware - Erro ao verificar permissões:', {
          error,
          path,
          userId: auth.userId
        });
        return NextResponse.next();
      }
    }

    console.log('Middleware - Permitindo acesso:', path);
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