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
  console.log('SignInPage - SearchParams:', searchParams.toString());

  useEffect(() => {
    const handleRedirect = async () => {
      if (isLoaded && userId && user) {
        console.log('SignInPage - Iniciando redirecionamento após autenticação');
        
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = adminEmails.includes(userEmail);
        
        console.log('SignInPage - Dados do redirecionamento:', {
          adminEmails,
          userEmail,
          isAdmin,
          searchParams: searchParams.toString()
        });

        // Determina a página de destino
        let targetPath = isAdmin ? '/admin' : '/client';
        
        // Se houver um redirect_url nos parâmetros, use-o (se apropriado)
        const redirectUrl = searchParams.get('redirect_url');
        if (redirectUrl) {
          if (redirectUrl.startsWith('/admin') && isAdmin) {
            targetPath = '/admin';
          } else if (redirectUrl.startsWith('/client') && !isAdmin) {
            targetPath = '/client';
          }
        }

        console.log('SignInPage - Redirecionamento final para:', targetPath);
        
        try {
          await router.replace(targetPath);
          console.log('SignInPage - Redirecionamento executado com sucesso');
        } catch (error) {
          console.error('SignInPage - Erro no redirecionamento:', error);
        }
      }
    };

    handleRedirect();
  }, [isLoaded, userId, user, router, searchParams]);

  if (!isLoaded || userId) {
    console.log('SignInPage - Aguardando carregamento ou já autenticado');
    return null;
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