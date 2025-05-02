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

  const handleRedirect = useCallback(async () => {
    if (!isLoaded || isRedirecting) return;

    const redirectUrl = searchParams.get('redirect_url');
    const currentUrl = pathname + searchParams.toString();

    // Evita loops de redirecionamento
    if (lastRedirect === currentUrl) {
      console.log('AuthProvider - Evitando loop de redirecionamento:', currentUrl);
      return;
    }

    // Verifica se está em um processo de autenticação OAuth
    if (pathname.includes('oauth') || pathname.includes('sso-callback')) {
      console.log('AuthProvider - Processo OAuth em andamento');
      return;
    }

    try {
      // Se estiver em uma rota de autenticação e já estiver autenticado
      if ((pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) && isSignedIn) {
        setIsRedirecting(true);
        setLastRedirect(currentUrl);
        
        const targetPath = redirectUrl || (userId ? '/admin' : '/client');
        console.log('AuthProvider - Redirecionando após login:', targetPath);
        
        // Pequeno delay antes do redirecionamento
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = targetPath; // Usando window.location para forçar recarga completa
        return;
      }

      // Se não estiver autenticado e tentar acessar uma rota protegida
      if (!isSignedIn && (pathname.startsWith('/admin') || pathname.startsWith('/client'))) {
        setIsRedirecting(true);
        setLastRedirect(currentUrl);
        
        const signInPath = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;
        console.log('AuthProvider - Redirecionando para login:', signInPath);
        window.location.href = signInPath; // Usando window.location para forçar recarga completa
        return;
      }
    } catch (error) {
      console.error('AuthProvider - Erro durante redirecionamento:', error);
      setIsRedirecting(false);
    }
  }, [isLoaded, isSignedIn, pathname, searchParams, userId, lastRedirect, isRedirecting]);

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
        lastRedirect
      });
    }
  }, [isLoaded, isSignedIn, pathname, sessionId, userId, isRedirecting, lastRedirect]);

  if (!isLoaded) {
    return <div>Carregando...</div>;
  }

  return <>{children}</>;
} 