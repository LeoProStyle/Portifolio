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
];

async function isAdmin(userId) {
  try {
    console.log('DEBUG [Vercel] - Verificando admin para userId:', userId);
    
    if (!userId) {
      console.log('DEBUG [Vercel] - userId não fornecido');
      return false;
    }
    
    const user = await clerkClient.users.getUser(userId);
    if (!user) {
      console.log('DEBUG [Vercel] - Usuário não encontrado');
      return false;
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      console.log('DEBUG [Vercel] - Email não encontrado');
      return false;
    }

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
      .map(e => e.trim())
      .filter(Boolean);

    console.log('DEBUG [Vercel] - Verificação de admin:', {
      userEmail,
      adminEmails,
      isAdmin: adminEmails.includes(userEmail)
    });

    return adminEmails.includes(userEmail);
  } catch (error) {
    console.error('DEBUG [Vercel] - Erro ao verificar admin:', error);
    return false;
  }
}

export default authMiddleware({
  publicRoutes,
  
  async afterAuth(auth, req) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log('DEBUG [Vercel] - Middleware iniciado:', {
      path,
      auth: {
        userId: auth.userId,
        isPublicRoute: auth.isPublicRoute,
        sessionId: auth.sessionId
      }
    });

    // Permite acesso a rotas públicas
    if (publicRoutes.some(pattern => {
      if (pattern.endsWith('(.*)')) {
        return path.startsWith(pattern.replace('(.*)', ''));
      }
      return path === pattern;
    })) {
      console.log('DEBUG [Vercel] - Rota pública permitida:', path);
      return NextResponse.next();
    }

    // Redireciona usuários não autenticados para login
    if (!auth.userId) {
      console.log('DEBUG [Vercel] - Redirecionando para login:', path);
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', path);
      return NextResponse.redirect(signInUrl);
    }

    try {
      const adminStatus = await isAdmin(auth.userId);
      console.log('DEBUG [Vercel] - Status do usuário:', {
        path,
        userId: auth.userId,
        isAdmin: adminStatus,
        currentUrl: req.url
      });

      // Redireciona admin tentando acessar área de cliente
      if (adminStatus && path.startsWith('/client')) {
        console.log('DEBUG [Vercel] - Redirecionando admin para área administrativa');
        return NextResponse.redirect(new URL('/admin', req.url));
      }

      // Redireciona cliente tentando acessar área de admin
      if (!adminStatus && path.startsWith('/admin')) {
        console.log('DEBUG [Vercel] - Redirecionando cliente para sua área');
        return NextResponse.redirect(new URL('/client', req.url));
      }

      // Se estiver na raiz, redireciona para a área apropriada
      if (path === '/') {
        const redirectUrl = new URL(adminStatus ? '/admin' : '/client', req.url);
        console.log('DEBUG [Vercel] - Redirecionando da raiz para:', redirectUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      console.log('DEBUG [Vercel] - Acesso permitido para:', path);
      return NextResponse.next();
    } catch (error) {
      console.error('DEBUG [Vercel] - Erro no middleware:', error);
      return NextResponse.next();
    }
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}; 