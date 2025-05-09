'use client';

import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from './AuthProvider';
import UserNav from "./UserNav";
import { ptBR } from "@clerk/localizations";

export default function ClientLayout({ children }) {
  return (
    <ClerkProvider 
      localization={ptBR}
      appearance={{
        baseTheme: undefined,
        variables: { colorPrimary: '#1a56db' },
        elements: {
          formButtonPrimary: 
            "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
          card: "shadow-none",
        },
      }}
    >
      <AuthProvider>
        <nav className="bg-gray-800 p-4 text-white flex justify-between items-center">
          <h1 className="font-bold xs:text-xs md:text-xl">Sistema de Cartão Digital</h1>
          <UserNav />
        </nav>
        <main>{children}</main>
      </AuthProvider>
    </ClerkProvider>
  );
} 