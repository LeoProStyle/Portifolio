'use client';

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
              card: 'shadow-none',
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
} 