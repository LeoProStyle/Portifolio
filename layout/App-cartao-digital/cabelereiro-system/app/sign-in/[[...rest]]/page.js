'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  console.log('SignInPage - Estado Inicial:', {
    isLoaded,
    userId,
    hasUser: !!user,
    userEmail: user?.emailAddresses?.[0]?.emailAddress,
    isRedirecting
  });

  useEffect(() => {
    console.log('SignInPage - useEffect Triggered:', {
      isLoaded,
      userId,
      hasUser: !!user,
      isRedirecting
    });

    if (!isLoaded || !userId || !user || isRedirecting) {
      return;
    }

    const redirect = () => {
      try {
        console.log('SignInPage - Iniciando redirecionamento');
        setIsRedirecting(true);

        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = adminEmails.includes(userEmail);

        console.log('SignInPage - Verificação de Admin:', {
          userEmail,
          adminEmails,
          isAdmin
        });

        const targetPath = isAdmin ? '/admin' : '/client';
        console.log('SignInPage - Redirecionando para:', targetPath);

        // Força o redirecionamento usando window.location
        window.location.href = targetPath;
      } catch (error) {
        console.error('SignInPage - Erro no redirecionamento:', error);
        setIsRedirecting(false);
      }
    };

    // Pequeno delay para garantir que o estado do Clerk está sincronizado
    const timeoutId = setTimeout(redirect, 500);
    return () => clearTimeout(timeoutId);
  }, [isLoaded, userId, user, isRedirecting]);

  if (!isLoaded || userId || isRedirecting) {
    console.log('SignInPage - Renderizando loading:', {
      isLoaded,
      userId,
      isRedirecting
    });

    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Carregando...</p>
        <p className="mt-2 text-sm text-gray-500">
          {!isLoaded ? 'Inicializando...' : 
           isRedirecting ? 'Redirecionando...' : 
           'Verificando autenticação...'}
        </p>
      </div>
    );
  }

  console.log('SignInPage - Renderizando formulário de login');
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
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