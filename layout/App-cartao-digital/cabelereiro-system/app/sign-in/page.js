'use client';

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Aguarda 1 segundo para ter certeza que o estado de autenticação está correto
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isLoaded && isSignedIn) {
        console.log('[SignIn Debug] Usuário autenticado, redirecionando...');
        router.replace('/');
      } else {
        console.log('[SignIn Debug] Usuário não autenticado, mostrando formulário');
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Verificando autenticação...</p>
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