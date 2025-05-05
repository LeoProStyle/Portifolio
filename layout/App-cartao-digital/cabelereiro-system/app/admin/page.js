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
  const [searchTerm, setSearchTerm] = useState("");
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

      if (!user) {
        console.log('[Admin Debug] Usuário não autenticado, redirecionando...');
        window.location.href = '/sign-in';
        return;
      }

      const userRole = getUserRole(user);
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
    };
  }, [isLoaded, user, loadClients]);

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
      await signOut();
      window.location.href = '/sign-in';
    } catch (err) {
      setError('Erro ao fazer logout');
    }
  };

  // Função para filtrar clientes com verificação para evitar erros
  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    
    const searchTermLower = searchTerm.toLowerCase();
    const nameMatch = client.name ? client.name.toLowerCase().includes(searchTermLower) : false;
    const nicknameMatch = client.nickname ? client.nickname.toLowerCase().includes(searchTermLower) : false;
    return nameMatch || nicknameMatch;
  });

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <main className="p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Área Administrativa</h1>
        <button 
          onClick={handleSignOut} 
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors cursor-pointer"
        >
          Sair
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Campo de pesquisa */}
      <div className="relative">
        <input
          type="text"
          placeholder="Pesquisar por nome ou apelido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {clients.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente encontrado com esse termo."}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Apelido
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-ins
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cortes Grátis
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map(client => (
                <tr key={client._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.name || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.nickname || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.checkIns || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.freeCuts || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => checkIn(client._id)}
                      className="text-white bg-green-500 hover:bg-green-600 px-3 py-1 rounded transition-colors cursor-pointer"
                    >
                      Check-in
                    </button>
                    {client.freeCuts > 0 && (
                      <button
                        onClick={() => useFreeCut(client._id)}
                        className="text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded transition-colors cursor-pointer" 
                      >
                        Usar Corte Grátis
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}