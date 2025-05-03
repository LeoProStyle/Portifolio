// app/admin/page.js
"use client";
import { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  console.log('AdminPage - Renderizando componente');
  console.log('AdminPage - User:', user);

  // Lista de emails de admin
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
  console.log('AdminPage - ADMIN_EMAILS:', ADMIN_EMAILS);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!isLoaded) return;

      if (!user) {
        window.location.href = '/sign-in';
        return;
      }

      const userRole = getUserRole(user);
      if (userRole !== 'admin') {
        window.location.href = '/client';
        return;
      }

      if (mounted) {
        try {
          const response = await fetch("/api/clients");
          if (!response.ok) throw new Error('Falha ao carregar clientes');
          const data = await response.json();
          if (mounted) {
            setClients(data);
            setLoading(false);
          }
        } catch (err) {
          if (mounted) {
            setError(err.message);
            setLoading(false);
          }
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [isLoaded, user]);

  const addClient = async () => {
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error('Falha ao adicionar cliente');

      const updatedResponse = await fetch("/api/clients");
      if (!updatedResponse.ok) throw new Error('Falha ao atualizar lista');
      
      const data = await updatedResponse.json();
      setClients(data);
      setName("");
    } catch (err) {
      setError(err.message);
    }
  };

  const checkIn = async (id) => {
    try {
      const response = await fetch(`/api/clients/${id}/checkin`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao realizar check-in');
      
      const updatedResponse = await fetch("/api/clients");
      if (!updatedResponse.ok) throw new Error('Falha ao atualizar lista');
      
      const data = await updatedResponse.json();
      setClients(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const useFreeCut = async (id) => {
    try {
      const response = await fetch(`/api/clients/${id}/use-free-cut`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao usar corte grátis');
      
      const updatedResponse = await fetch("/api/clients");
      if (!updatedResponse.ok) throw new Error('Falha ao atualizar lista');
      
      const data = await updatedResponse.json();
      setClients(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/sign-in';
    } catch (err) {
      setError('Erro ao fazer logout');
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl mb-4">Faça login para usar o sistema</h1>
        </div>
      </div>
    );
  }

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Área Administrativa</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <button onClick={handleSignOut} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">
        Sair
      </button>

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
    </main>
  );
}
