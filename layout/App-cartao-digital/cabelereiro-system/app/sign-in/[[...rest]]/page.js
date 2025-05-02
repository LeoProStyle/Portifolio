'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { isLoaded, userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const searchParams = useSearchParams();

  console.log('SignInPage - Estado Inicial:', {
    isLoaded,
    userId,
    hasUser: !!user,
    userEmail: user?.emailAddresses?.[0]?.emailAddress,
    isRedirecting
  });

  useEffect(() => {
    if (!isLoaded) return;

    const estado = {
      isLoaded,
      userId,
      isSignedIn,
      isRedirecting
    };
    console.log('SignInPage - Estado:', estado);

    // Se já estiver autenticado, deixa o AuthProvider lidar com o redirecionamento
    if (isSignedIn) {
      console.log('SignInPage - Usuário já autenticado, aguardando redirecionamento');
      return;
    }
  }, [isLoaded, userId, isSignedIn, isRedirecting]);

  if (!isLoaded) {
    return <div>Carregando...</div>;
  }

  // Se estiver redirecionando, mostra loading
  if (isRedirecting) {
    return <div>Redirecionando...</div>;
  }

  console.log('SignInPage - Renderizando formulário de login');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Entrar no Sistema</h2>
          <p className="mt-2 text-gray-600">
            Faça login para acessar sua conta
          </p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
              footerActionLink: 'text-blue-500 hover:text-blue-600'
            }
          }}
        />
      </div>
    </div>
  );
}