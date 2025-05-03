// app/admin/page.js
"use client";
import { useEffect, useState, useCallback } from "react";
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

  const loadClients = useCallback(async () => {
    try {
      console.log('[Admin Debug] Carregando lista de clientes');
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      const data = await response.json();
      setClients(data);
      setLoading(false);
      console.log('[Admin Debug] Clientes carregados com sucesso');
    } catch (err) {
      console.error('[Admin Debug] Erro ao carregar clientes:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!isLoaded) {
        console.log('[Admin Debug] Aguardando Clerk carregar...');
        return;
      }

      console.log('[Admin Debug] Estado de autenticação:', {
        isLoaded,
        hasUser: !!user,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });

      if (!user) {
        console.log('[Admin Debug] Usuário não autenticado, redirecionando...');
        window.location.href = '/sign-in';
        return;
      }

      const userRole = getUserRole(user);
      console.log('[Admin Debug] Verificação de papel:', {
        email: user.primaryEmailAddress?.emailAddress,
        role: userRole
      });

      if (userRole !== 'admin') {
        console.log('[Admin Debug] Acesso negado, redirecionando para área de cliente');
        window.location.href = '/client';
        return;
      }

      if (mounted) {
        await loadClients();
      }
    }

    checkAuth();

    return () => {
      mounted = false;
      console.log('[Admin Debug] Limpeza do componente');
    };
  }, [isLoaded, user, loadClients]);

  const addClient = async () => {
    try {
      console.log('[Admin Debug] Adicionando novo cliente');
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error('Falha ao adicionar cliente');
      setName("");
      await loadClients();
      console.log('[Admin Debug] Cliente adicionado com sucesso');
    } catch (err) {
      console.error('[Admin Debug] Erro ao adicionar cliente:', err);
      setError(err.message);
    }
  };

  const checkIn = async (id) => {
    try {
      console.log('[Admin Debug] Realizando check-in');
      const response = await fetch(`/api/clients/${id}/checkin`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao realizar check-in');
      await loadClients();
      console.log('[Admin Debug] Check-in realizado com sucesso');
    } catch (err) {
      console.error('[Admin Debug] Erro no check-in:', err);
      setError(err.message);
    }
  };

  const useFreeCut = async (id) => {
    try {
      console.log('[Admin Debug] Usando corte grátis');
      const response = await fetch(`/api/clients/${id}/use-free-cut`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao usar corte grátis');
      await loadClients();
      console.log('[Admin Debug] Corte grátis usado com sucesso');
    } catch (err) {
      console.error('[Admin Debug] Erro ao usar corte grátis:', err);
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('[Admin Debug] Iniciando logout');
      await signOut();
      window.location.href = '/sign-in';
    } catch (err) {
      console.error('[Admin Debug] Erro no logout:', err);
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
