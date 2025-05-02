'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    let timeoutId;

    const handleAuth = async () => {
      if (isLoaded && userId && user && !isRedirecting) {
        setIsRedirecting(true);
        
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const isAdmin = adminEmails.includes(userEmail);

        // Pequeno delay para garantir que o estado do Clerk está sincronizado
        timeoutId = setTimeout(() => {
          router.push(isAdmin ? '/admin' : '/client');
        }, 100);
      }
    };

    handleAuth();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoaded, userId, user, router, isRedirecting]);

  if (!isLoaded || userId || isRedirecting) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Carregando...</p>
      </div>
    );
  }

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