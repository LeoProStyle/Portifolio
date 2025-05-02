'use client';
import { SignUp, useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && userId) {
      // Verifica se o email do usuário está na lista de admins
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      const isAdmin = adminEmails.includes(userEmail);

      // Redireciona baseado no tipo de usuário
      router.replace(isAdmin ? '/admin' : '/client');
    }
  }, [isLoaded, userId, user, router]);

  // Se estiver carregando ou já autenticado, não mostra nada
  if (!isLoaded || userId) {
    return null;
  }

  // Se não estiver autenticado, mostra o componente de cadastro
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <SignUp 
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