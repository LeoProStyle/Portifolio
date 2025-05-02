'use client';
import { SignUp, useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignUpPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('SignUpPage - Renderizando componente');
  console.log('SignUpPage - Auth state:', { isLoaded, userId });
  console.log('SignUpPage - User:', user);

  useEffect(() => {
    console.log('SignUpPage - useEffect de redirecionamento');
    if (isLoaded && userId) {
      console.log('SignUpPage - Usuário está autenticado');
      
      // Verifica se o email do usuário está na lista de admins
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
      console.log('SignUpPage - Lista de admins:', adminEmails);
      
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      console.log('SignUpPage - Email do usuário:', userEmail);
      
      const isAdmin = adminEmails.includes(userEmail);
      console.log('SignUpPage - É admin?', isAdmin);

      // Pega a URL de redirecionamento dos parâmetros ou usa o padrão
      let redirectUrl = searchParams.get('redirect_url');
      console.log('SignUpPage - URL de redirecionamento original:', redirectUrl);
      
      // Se tiver URL de redirecionamento, extrai apenas o caminho
      if (redirectUrl) {
        try {
          const url = new URL(redirectUrl);
          redirectUrl = url.pathname;
          console.log('SignUpPage - URL de redirecionamento convertida para caminho:', redirectUrl);
        } catch (e) {
          console.log('SignUpPage - URL já é um caminho:', redirectUrl);
        }
      }
      
      if (redirectUrl) {
        console.log('SignUpPage - Tem URL de redirecionamento');
        if (redirectUrl.includes('/admin') && !isAdmin) {
          console.log('SignUpPage - Tentativa de acesso admin não autorizada');
          router.replace('/client');
        } else if (redirectUrl.includes('/client') && isAdmin) {
          console.log('SignUpPage - Admin tentando acessar área de cliente');
          router.replace('/admin');
        } else {
          console.log('SignUpPage - Redirecionando para:', redirectUrl);
          router.replace(redirectUrl);
        }
      } else {
        console.log('SignUpPage - Sem URL de redirecionamento, usando padrão');
        router.replace(isAdmin ? '/admin' : '/client');
      }
    } else {
      console.log('SignUpPage - Usuário não está autenticado ou ainda carregando');
    }
  }, [isLoaded, userId, user, router, searchParams]);

  // Se estiver carregando ou já autenticado, não mostra nada
  if (!isLoaded || userId) {
    console.log('SignUpPage - Retornando null (carregando ou autenticado)');
    return null;
  }

  console.log('SignUpPage - Mostrando componente de cadastro');
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
          redirectUrl={searchParams.get('redirect_url')}
        />
      </div>
    </div>
  );
} 