'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const handleRedirect = async () => {
      const redirectUrl = searchParams.get('redirect_url');
      
      if (isRedirecting) return;

      // Verifica se está em um processo de autenticação OAuth
      if (pathname.includes('oauth') || pathname.includes('sso-callback')) {
        console.log('AuthProvider - Processo OAuth em andamento');
        return;
      }

      // Se estiver em uma rota de autenticação e já estiver autenticado
      if ((pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) && isSignedIn) {
        setIsRedirecting(true);
        const targetPath = redirectUrl || '/client';
        console.log('AuthProvider - Redirecionando após login:', targetPath);
        
        // Pequeno delay antes do redirecionamento
        await new Promise(resolve => setTimeout(resolve, 500));
        router.push(targetPath);
        return;
      }

      // Se não estiver autenticado e tentar acessar uma rota protegida
      if (!isSignedIn && (pathname.startsWith('/admin') || pathname.startsWith('/client'))) {
        setIsRedirecting(true);
        const signInPath = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;
        console.log('AuthProvider - Redirecionando para login:', signInPath);
        router.push(signInPath);
        return;
      }
    };

    handleRedirect();
  }, [isLoaded, isSignedIn, pathname, router, searchParams, isRedirecting, sessionId]);

  // Adiciona logs para debug
  useEffect(() => {
    if (isLoaded) {
      console.log('AuthProvider - Estado:', {
        isSignedIn,
        pathname,
        sessionId,
        isRedirecting
      });
    }
  }, [isLoaded, isSignedIn, pathname, sessionId, isRedirecting]);

  if (!isLoaded) {
    return <div>Carregando...</div>;
  }

  return <>{children}</>;
} 