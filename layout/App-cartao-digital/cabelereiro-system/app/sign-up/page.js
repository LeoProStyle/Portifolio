'use client';

import { SignUp, useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { getUserRole } from "@/lib/auth";

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    const handleRedirect = async () => {
      console.log('[SignUp Debug] Estado atual:', {
        isLoaded,
        isSignedIn,
        hasUser: !!user,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        redirectAttempted: redirectAttempted.current
      });

      if (!isLoaded || !isSignedIn || !user || redirectAttempted.current) {
        return;
      }

      try {
        redirectAttempted.current = true;
        console.log('[SignUp Debug] Verificando papel do usuário...');
        
        const userRole = getUserRole(user);
        const redirectPath = userRole === 'admin' ? '/admin' : '/client';
        
        console.log('[SignUp Debug] Redirecionamento:', {
          email: user.primaryEmailAddress?.emailAddress,
          role: userRole,
          path: redirectPath
        });

        window.location.replace(redirectPath);
      } catch (error) {
        console.error('[SignUp Error]:', error);
        redirectAttempted.current = false;
      }
    };

    handleRedirect();
  }, [isLoaded, isSignedIn, user]);

  // Se já estiver autenticado, mostra tela de carregamento
  if (isSignedIn && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Redirecionando...</p>
        </div>
      </div>
    );
  }

  const afterSignUpUrl = "/admin"; // Define para onde o Clerk deve redirecionar após registro

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
              card: 'shadow-none',
            },
          }}
          redirectUrl={afterSignUpUrl}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
} 