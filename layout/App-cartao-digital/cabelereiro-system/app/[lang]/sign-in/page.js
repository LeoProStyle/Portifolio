'use client';

import { assets } from "@/assets/assets";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import LanguageSelector from '../../components/LanguageSelector';
import { getDictionary } from '../../i18n/settings';

export default async function SignInPage({ params: { lang } }) {
  const dict = await getDictionary(lang);
  const { isSignedIn, isLoaded } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (isLoaded && isSignedIn && !redirectAttempted.current) {
        redirectAttempted.current = true;
        window.location.href = `/${lang}`;
      } else if (isLoaded && !isSignedIn) {
        setIsChecking(false);
      }
    };

    if (!redirectAttempted.current) {
      checkAuth();
    }
  }, [isLoaded, isSignedIn, lang]);

  if (!isLoaded || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p>{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-6 sm:px-6 lg:px-8 overflow-hidden">
      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          <Image
            src={assets.foto04}
            alt="Background"
            fill
            className="opacity-10 object-cover"
            priority
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-500 tracking-wider uppercase text-center mb-2">
          Salão do Rafinha
        </h1>
        <div className="h-1 w-24 sm:w-32 bg-gradient-to-r from-red-500 via-white to-blue-500 my-2 sm:my-3 rounded"></div>
        <p className="text-sm sm:text-base text-gray-300 italic text-center">
          Estilo e precisão em cada corte
        </p>
      </div>

      {/* Sign In Form */}
      <div className="relative z-10 w-full max-w-md p-4 sm:p-6 md:p-8 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700">
        <SignIn
          appearance={{
            layout: {
              socialButtonsPlacement: "bottom",
              socialButtonsVariant: "blockButton",
              showOptionalFields: false,
            },
            elements: {
              rootBox: "w-full mx-auto",
              card: "!w-auto shadow-none bg-transparent p-0 sm:p-1",
              headerTitle: "text-amber-500 text-xl sm:text-2xl text-center mb-4",
              headerSubtitle: "text-gray-300 text-sm sm:text-base text-center mb-6",
              socialButtonsIconButton: "w-full max-w-full",
              socialButtonsBlockButton: "w-full max-w-full mb-2 text-sm sm:text-base",
              formButtonPrimary: 'w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold transition-colors duration-200 py-3 text-sm sm:text-base rounded-md',
              formFieldInput: 'w-full bg-gray-700/90 border-gray-600 text-white rounded-md focus:ring-amber-500 focus:border-amber-500 text-sm sm:text-base p-2.5',
              formFieldLabel: 'text-gray-300 text-sm sm:text-base mb-1',
              footer: 'border-gray-700 text-center',
              footerActionText: "text-gray-400 text-sm sm:text-base",
              footerActionLink: 'text-amber-400 hover:text-amber-300 transition-colors duration-200 text-sm sm:text-base',
              dividerLine: "bg-gray-600",
              dividerText: "text-gray-400 text-sm",
              formFieldAction: 'text-amber-400 hover:text-amber-300 transition-colors duration-200 text-sm sm:text-base',
              form: 'space-y-4 w-full',
              identityPreviewText: 'text-gray-300 text-sm sm:text-base',
              identityPreviewEditButton: 'text-amber-400 hover:text-amber-300 text-sm sm:text-base',
              alert: 'text-sm sm:text-base',
            },
          }}
          redirectUrl={`/${lang}`}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          localization={{
            signIn: {
              title: dict.signIn.title,
              subtitle: dict.signIn.subtitle,
              primaryButtonText: dict.signIn.primaryButton,
              actionText: dict.signIn.noAccount,
              actionLink: dict.signIn.signUp,
            }
          }}
        />
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-6 sm:mt-8 text-center">
        <p className="text-xs sm:text-sm text-gray-400">{dict.common.copyright}</p>
      </div>
    </div>
  );
} 