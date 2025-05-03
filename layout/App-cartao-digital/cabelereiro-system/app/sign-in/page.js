'use client';

import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    console.log('[SignIn Debug] Estado inicial:', {
      isLoaded,
      isSignedIn,
      hasUser: !!user,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });

    if (!isLoaded) {
      console.log('[SignIn Debug] Clerk ainda carregando...');
      return;
    }

    if (isSignedIn && user) {
      console.log('[SignIn Debug] Usuário autenticado, verificando papel...');
      
      const userRole = getUserRole(user);
      console.log('[SignIn Debug] Papel do usuário:', {
        email: user.primaryEmailAddress?.emailAddress,
        role: userRole
      });

      const redirectPath = userRole === 'admin' ? '/admin' : '/client';
      console.log('[SignIn Debug] Redirecionando para:', redirectPath);
      
      // Usando window.location para evitar problemas com o router do Next.js
      window.location.href = redirectPath;
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || (isSignedIn && user)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          Carregando...
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
          afterSignInUrl={null}
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
} 