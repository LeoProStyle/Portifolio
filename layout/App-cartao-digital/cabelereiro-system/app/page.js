"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton, useUser, useClerk } from "@clerk/nextjs"; // Importando o useClerk
import { useRouter } from "next/navigation"; // Para navegação

export default function Home() {
  const [clients, setClients] = useState([]);
  const [name, setName] = useState("");
  const { user, signOut } = useUser(); // Usando o signOut do Clerk
  const router = useRouter(); // Usando o router para navegação
  const { signOut: clerkSignOut } = useClerk(); // Usando useClerk para garantir o signOut

  // Buscar os clientes e incluir as informações de cortes grátis
  useEffect(() => {
    fetch("/api/clients")
      .then(res => res.json())
      .then(setClients);
  }, []);

  // Função para adicionar um cliente
  const addClient = async () => {
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  // Função para realizar o check-in do cliente
  const checkIn = async (id) => {
    await fetch(`/api/clients/${id}/checkin`, {
      method: "POST",
    });
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  // Função para diminuir o número de cortes grátis
  const useFreeCut = async (id) => {
    await fetch(`/api/clients/${id}/use-free-cut`, {
      method: "POST",
    });
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  // Função para realizar o logoff e redirecionar para a página inicial
  const handleSignOut = async () => {
    await clerkSignOut(); // Usando Clerk's signOut
    router.push("/"); // Redireciona para a página inicial
  };

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <SignedIn>
        <h1 className="text-2xl font-bold">Olá, {user?.firstName}!</h1>

        <button
          onClick={handleSignOut} // Função de logoff
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
        >
          Sair
        </button>

        <div className="flex gap-2 justify-center mt-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="border px-2 py-1 rounded"
          />
          <button onClick={addClient} className="bg-blue-500 text-white px-3 py-1 rounded">
            Adicionar
          </button>
        </div>

        <ul className="mt-6 space-y-2">
          {clients.map(client => (
            <li key={client._id} className="flex justify-between items-center border-b pb-2">
              <span>{client.name} — {client.checkIns} check-in(s)</span>
              <span className="text-sm text-gray-500">Cortes grátis: {client.freeCuts}</span> {/* Exibe o número de cortes grátis */}
              
              {/* Botão para diminuir o número de cortes grátis */}
              {client.freeCuts > 0 && (
                <button
                  onClick={() => useFreeCut(client._id)}
                  className="text-sm bg-red-500 text-white px-2 py-1 rounded"
                >
                  Usar Corte Grátis
                </button>
              )}

              <button
                onClick={() => checkIn(client._id)}
                className="text-sm bg-green-500 text-white px-2 py-1 rounded"
              >
                Check-in
              </button>
            </li>
          ))}
        </ul>
      </SignedIn>

      <SignedOut>
        <h1 className="text-xl mb-4">Faça login para usar o sistema</h1>
        <SignInButton />
      </SignedOut>
    </main>
  );
}
