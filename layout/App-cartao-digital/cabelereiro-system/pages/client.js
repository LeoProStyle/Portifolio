"use client";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";

export default function ClientPage() {
  const { user } = useUser();

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <SignedIn>
        <h1 className="text-2xl font-bold">Minha Área</h1>
        <p>Bem-vindo à sua área, {user?.firstName}!</p>

        {/* Aqui você pode adicionar funcionalidades relacionadas ao cliente, como visualização de check-ins */}
      </SignedIn>

      <SignedOut>
        <h1 className="text-xl mb-4">Faça login para acessar sua área</h1>
      </SignedOut>
    </main>
  );
}
