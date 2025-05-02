'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('SignInPage - Renderizando componente');
  console.log('SignInPage - Auth state:', { isLoaded, userId });
  console.log('SignInPage - User:', user);

  useEffect(() => {
    console.log('SignInPage - useEffect de redirecionamento');
    if (isLoaded && userId) {
      console.log('SignInPage - Usuário está autenticado');
      
      // Verifica se o email do usuário está na lista de admins
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
      console.log('SignInPage - Lista de admins:', adminEmails);
      
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      console.log('SignInPage - Email do usuário:', userEmail);
      
      const isAdmin = adminEmails.includes(userEmail);
      console.log('SignInPage - É admin?', isAdmin);

      // Pega a URL de redirecionamento dos parâmetros ou usa o padrão
      const redirectUrl = searchParams.get('redirect_url');
      console.log('SignInPage - URL de redirecionamento:', redirectUrl);
      
      if (redirectUrl) {
        console.log('SignInPage - Tem URL de redirecionamento');
        if (redirectUrl.includes('/admin') && !isAdmin) {
          console.log('SignInPage - Tentativa de acesso admin não autorizada');
          router.replace('/client');
        } else if (redirectUrl.includes('/client') && isAdmin) {
          console.log('SignInPage - Admin tentando acessar área de cliente');
          router.replace('/admin');
        } else {
          console.log('SignInPage - Redirecionando para:', redirectUrl);
          router.replace(redirectUrl);
        }
      } else {
        console.log('SignInPage - Sem URL de redirecionamento, usando padrão');
        router.replace(isAdmin ? '/admin' : '/client');
      }
    } else {
      console.log('SignInPage - Usuário não está autenticado ou ainda carregando');
    }
  }, [isLoaded, userId, user, router, searchParams]);

  // Se estiver carregando ou já autenticado, não mostra nada
  if (!isLoaded || userId) {
    console.log('SignInPage - Retornando null (carregando ou autenticado)');
    return null;
  }

  console.log('SignInPage - Mostrando componente de login');
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