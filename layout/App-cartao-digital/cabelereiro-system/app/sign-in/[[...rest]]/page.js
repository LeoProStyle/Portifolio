'use client';
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && userId && user) {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
      const userEmail = user.emailAddresses[0]?.emailAddress;
      const isAdmin = adminEmails.includes(userEmail);

      // Redireciona diretamente para a página apropriada
      if (isAdmin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/client';
      }
    }
  }, [isLoaded, userId, user]);

  if (!isLoaded || userId) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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