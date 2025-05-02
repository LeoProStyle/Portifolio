'use client';
import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url');

  useEffect(() => {
    if (isLoaded && userId) {
      // Se já estiver autenticado, redireciona para a página apropriada
      router.replace(redirectUrl || '/admin');
    }
  }, [isLoaded, userId, router, redirectUrl]);

  // Não renderiza nada enquanto verifica autenticação
  if (!isLoaded || userId) {
    return null;
  }

  // Só renderiza o componente SignIn se não estiver autenticado
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
          redirectUrl={redirectUrl || '/admin'}
          routing="path"
          path="/sign-in"
        />
      </div>
    </div>
  );
}