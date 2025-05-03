'use client';

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Aguarda 2 segundos para ter certeza que o estado de autenticação está correto
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (isLoaded && isSignedIn && !redirectAttempted.current) {
        console.log('[SignIn Debug] Usuário autenticado, redirecionando...');
        redirectAttempted.current = true;
        window.location.href = '/';
      } else if (isLoaded && !isSignedIn) {
        console.log('[SignIn Debug] Usuário não autenticado, mostrando formulário');
        setIsChecking(false);
      }
    };

    if (!redirectAttempted.current) {
      checkAuth();
    }
  }, [isLoaded, isSignedIn]);

  // Efeito adicional para verificar mudanças no estado de autenticação
  useEffect(() => {
    if (isSignedIn && !redirectAttempted.current) {
      console.log('[SignIn Debug] Estado de autenticação mudou, redirecionando...');
      redirectAttempted.current = true;
      window.location.href = '/';
    }
  }, [isSignedIn]);

  if (!isLoaded || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Verificando autenticação...</p>
          <p className="text-sm text-gray-500 mt-2">Por favor, aguarde...</p>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Redirecionando...</p>
          <p className="text-sm text-gray-500 mt-2">Você será redirecionado em instantes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
              card: 'shadow-none',
            },
          }}
          redirectUrl={null}
          routing="hash"
          path="/sign-in"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
} 