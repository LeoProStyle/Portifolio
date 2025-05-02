'use client';
import { SignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url');

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
          afterSignInUrl={redirectUrl || '/admin'}
          routing="path"
          path="/sign-in"
        />
      </div>
    </div>
  );
}