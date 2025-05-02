'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoaded && userId) {
      // Verifica se o email do usuário está na lista de admins
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      const isAdmin = adminEmails.includes(userEmail);

      // Pega a URL de redirecionamento dos parâmetros ou usa o padrão
      const redirectUrl = searchParams.get('redirect_url');
      
      if (redirectUrl) {
        // Se tiver URL de redirecionamento, verifica se o usuário tem permissão
        if (redirectUrl.includes('/admin') && !isAdmin) {
          // Se tentar acessar admin sem ser admin, redireciona para /client
          router.replace('/client');
        } else if (redirectUrl.includes('/client') && isAdmin) {
          // Se tentar acessar client sendo admin, redireciona para /admin
          router.replace('/admin');
        } else {
          // Se tiver permissão, redireciona para a URL solicitada
          router.replace(redirectUrl);
        }
      } else {
        // Se não tiver URL de redirecionamento, usa o padrão
        router.replace(isAdmin ? '/admin' : '/client');
      }
    }
  }, [isLoaded, userId, user, router, searchParams]);

  // Se estiver carregando ou já autenticado, não mostra nada
  if (!isLoaded || userId) {
    return null;
  }

  // Se não estiver autenticado, mostra o componente de login
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
          redirectUrl={searchParams.get('redirect_url')}
        />
      </div>
    </div>
  );
}