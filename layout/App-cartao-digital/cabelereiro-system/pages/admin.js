"use client";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";

export default function AdminPage() {
  const { user } = useUser();

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <SignedIn>
        <h1 className="text-2xl font-bold">Área Administrativa</h1>
        <p>Bem-vindo à área de administração, {user?.firstName}!</p>

        {/* Aqui você pode adicionar funcionalidades do administrador, como a gestão de clientes */}
        {/* Por exemplo, a listagem de clientes e ações relacionadas ao cabeleireiro */}
      </SignedIn>

      <SignedOut>
        <h1 className="text-xl mb-4">Faça login para acessar a área administrativa</h1>
      </SignedOut>
    </main>
  );
}
