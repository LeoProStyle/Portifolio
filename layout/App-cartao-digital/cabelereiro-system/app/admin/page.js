// app/admin/page.js
"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  console.log('AdminPage - Renderizando componente');
  console.log('AdminPage - User:', user);

  // Lista de emails de admin
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
  console.log('AdminPage - ADMIN_EMAILS:', ADMIN_EMAILS);

  useEffect(() => {
    console.log('AdminPage - useEffect de verificação de admin');
    if (user) {
      const userEmail = user.emailAddresses[0].emailAddress;
      console.log('AdminPage - Email do usuário:', userEmail);
      const isAdmin = ADMIN_EMAILS.includes(userEmail);
      console.log('AdminPage - É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('AdminPage - Não é admin, redirecionando para /client');
        router.push("/client");
      } else {
        console.log('AdminPage - É admin, carregando dados');
        loadClients();
      }
    }
  }, [user, router]);

  const loadClients = async () => {
    try {
      console.log('AdminPage - Iniciando carregamento de clientes');
      setLoading(true);
      const response = await fetch("/api/clients");
      console.log('AdminPage - Resposta da API:', response.status);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar clientes');
      }
      
      const data = await response.json();
      console.log('AdminPage - Dados recebidos:', data);
      setClients(data);
      setError(null);
    } catch (err) {
      console.error('AdminPage - Erro ao carregar clientes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addClient = async () => {
    try {
      console.log('AdminPage - Adicionando cliente:', name);
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Falha ao adicionar cliente');
      }

      setName("");
      await loadClients();
    } catch (err) {
      console.error('AdminPage - Erro ao adicionar cliente:', err);
      setError(err.message);
    }
  };

  const checkIn = async (id) => {
    try {
      console.log('AdminPage - Realizando check-in para cliente:', id);
      const response = await fetch(`/api/clients/${id}/checkin`, { method: "POST" });
      
      if (!response.ok) {
        throw new Error('Falha ao realizar check-in');
      }
      
      await loadClients();
    } catch (err) {
      console.error('AdminPage - Erro ao realizar check-in:', err);
      setError(err.message);
    }
  };

  const useFreeCut = async (id) => {
    try {
      console.log('AdminPage - Usando corte grátis para cliente:', id);
      const response = await fetch(`/api/clients/${id}/use-free-cut`, { method: "POST" });
      
      if (!response.ok) {
        throw new Error('Falha ao usar corte grátis');
      }
      
      await loadClients();
    } catch (err) {
      console.error('AdminPage - Erro ao usar corte grátis:', err);
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('AdminPage - Iniciando logout');
      await signOut();
      router.push("/");
    } catch (err) {
      console.error('AdminPage - Erro ao fazer logout:', err);
    }
  };

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <SignedIn>
        <h1 className="text-2xl font-bold">Área Administrativa</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <button onClick={handleSignOut} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">
          Sair
        </button>

        {loading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : (
          <>
            <div className="flex gap-2 justify-center mt-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do cliente"
                className="border px-2 py-1 rounded"
              />
              <button 
                onClick={addClient} 
                className="bg-blue-500 text-white px-3 py-1 rounded"
                disabled={!name.trim()}
              >
                Adicionar
              </button>
            </div>

            {clients.length === 0 ? (
              <p className="text-gray-500">Nenhum cliente cadastrado.</p>
            ) : (
              <ul className="mt-6 space-y-2">
                {clients.map(client => (
                  <li key={client._id} className="flex justify-between items-center border-b pb-2">
                    <span>{client.name} — {client.checkIns} check-in(s)</span>
                    <span className="text-sm text-gray-500">Cortes grátis: {client.freeCuts}</span>
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
            )}
          </>
        )}
      </SignedIn>

      <SignedOut>
        <h1 className="text-xl mb-4">Faça login para usar o sistema</h1>
      </SignedOut>
    </main>
  );
}
