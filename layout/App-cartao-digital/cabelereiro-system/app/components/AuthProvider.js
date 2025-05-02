'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, sessionId, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [lastRedirect, setLastRedirect] = useState('');

  // Função para verificar se o usuário é admin
  const isAdmin = useCallback(() => {
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    return adminEmails.includes(user?.emailAddresses?.[0]?.emailAddress);
  }, [user]);

  const handleRedirect = useCallback(async () => {
    if (!isLoaded || isRedirecting) return;

    const redirectUrl = searchParams.get('redirect_url');
    const currentUrl = pathname + searchParams.toString();

    // Evita loops de redirecionamento
    if (lastRedirect === currentUrl) {
      console.log('AuthProvider - Evitando loop de redirecionamento:', currentUrl);
      return;
    }

    try {
      // Se estiver em uma rota de autenticação e já estiver autenticado
      if ((pathname === '/' || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) && isSignedIn) {
        setIsRedirecting(true);
        setLastRedirect(currentUrl);
        
        // Redireciona baseado no tipo de usuário
        const targetPath = isAdmin() ? process.env.NEXT_PUBLIC_ADMIN_URL : process.env.NEXT_PUBLIC_CLIENT_URL;
        console.log('AuthProvider - Redirecionando após login:', targetPath);
        
        window.location.href = targetPath;
        return;
      }

      // Se não estiver autenticado e tentar acessar uma rota protegida
      if (!isSignedIn && (pathname.startsWith('/admin') || pathname.startsWith('/client'))) {
        setIsRedirecting(true);
        setLastRedirect(currentUrl);
        
        const signInPath = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;
        console.log('AuthProvider - Redirecionando para login:', signInPath);
        window.location.href = signInPath;
        return;
      }

      // Se estiver autenticado mas tentar acessar área errada
      if (isSignedIn) {
        if (pathname.startsWith('/admin') && !isAdmin()) {
          window.location.href = process.env.NEXT_PUBLIC_CLIENT_URL;
          return;
        }
        if (pathname.startsWith('/client') && isAdmin()) {
          window.location.href = process.env.NEXT_PUBLIC_ADMIN_URL;
          return;
        }
      }
    } catch (error) {
      console.error('AuthProvider - Erro durante redirecionamento:', error);
      setIsRedirecting(false);
    }
  }, [isLoaded, isSignedIn, pathname, searchParams, isAdmin, lastRedirect, isRedirecting]);

  useEffect(() => {
    handleRedirect();
  }, [handleRedirect]);

  // Logs para debug
  useEffect(() => {
    if (isLoaded) {
      console.log('AuthProvider - Estado:', {
        isSignedIn,
        pathname,
        sessionId,
        userId,
        isRedirecting,
        lastRedirect,
        isAdmin: isAdmin()
      });
    }
  }, [isLoaded, isSignedIn, pathname, sessionId, userId, isRedirecting, lastRedirect, isAdmin]);

  if (!isLoaded) {
    return <div>Carregando...</div>;
  }

  return <>{children}</>;
} 