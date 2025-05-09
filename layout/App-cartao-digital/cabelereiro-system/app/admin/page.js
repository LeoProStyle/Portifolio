//app/admin/page.js
"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Adicionar estados para controlar o carregamento de cada botão por cliente
  const [loadingCheckins, setLoadingCheckins] = useState({});
  const [loadingFreeCuts, setLoadingFreeCuts] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToReset, setClientToReset] = useState(null);
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
    setLoadingCheckins(prev => ({ ...prev, [id]: true }));

    try {
      console.log('[Admin Debug] Realizando check-in');
      const response = await fetch(`/api/clients/${id}/checkin`, { method: "POST" });

      if (!response.ok) {
        const data = await response.json();
        if (data.message === "Cartão precisa ser resetado.") {
          setClientToReset(id); // Define o cliente a ser resetado
          setIsModalOpen(true); // Abre a modal de confirmação
        } else {
          throw new Error('Falha ao realizar check-in');
        }
      } else {
        await loadClients();
        toast.success('Check-in realizado com sucesso!'); // Exibe o toast de sucesso
        console.log('[Admin Debug] Check-in realizado com sucesso');
      }
    } catch (err) {
      console.error('[Admin Debug] Erro no check-in:', err);
      setError(err.message);
      toast.error(`Erro: ${err.message}`); // Exibe o toast de erro
    } finally {
      setLoadingCheckins(prev => ({ ...prev, [id]: false }));
    }
  };

  const useFreeCut = async (id) => {
    setLoadingFreeCuts(prev => ({ ...prev, [id]: true }));

    try {
      console.log('[Admin Debug] Usando corte grátis');
      const response = await fetch(`/api/clients/${id}/use-free-cut`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao usar corte grátis');
      await loadClients();
      toast.success('Corte grátis usado com sucesso!'); // Exibe o toast de sucesso
      console.log('[Admin Debug] Corte grátis usado com sucesso');
    } catch (err) {
      console.error('[Admin Debug] Erro ao usar corte grátis:', err);
      setError(err.message);
      toast.error(`Erro: ${err.message}`); // Exibe o toast de erro
    } finally {
      setLoadingFreeCuts(prev => ({ ...prev, [id]: false }));
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-700 text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  //funçao para confirma reset do cartao 
  const confirmResetCard = async () => {
    try {
      const response = await fetch(`/api/clients/${clientToReset}/reset-card`, { method: "POST" });
      if (!response.ok) throw new Error('Falha ao resetar cartão');
      await loadClients(); // Recarrega a lista de clientes
      setIsModalOpen(false); // Fecha o modal
      toast.success('Cartão resetado com sucesso!'); // Exibe o toast de sucesso
    } catch (err) {
      console.error('Erro ao resetar cartão:', err);
      setError(err.message);
      toast.error(`Erro: ${err.message}`); // Exibe o toast de erro
    }
  };











  return (
    <>

     {/* Renderização do Toast */}
     <ToastContainer position="top-right" autoClose={5000} hideProgressBar newestOnTop />



      <main className="bg-gray-50 min-h-screen">
        {/* Header fixed no topo */}
        <header className="bg-white shadow-md sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Área Administrativa</h1>
            <button
              onClick={handleSignOut}
              className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-2"
            >
              <span className="hidden sm:inline">Sair</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 0v14h12V3H4z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M13.707 8.707a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L10.586 10 9.293 8.707a1 1 0 011.414-1.414l3 3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Campo de pesquisa com ícone */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Pesquisar por nome ou apelido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {filteredClients.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="mt-4 text-gray-500 text-lg">
                {clients.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente encontrado com esse termo."}
              </p>
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              {/* Versão para desktop - tabela normal */}
              <div className="hidden md:block">
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
                          <div className="text-sm font-medium bg-blue-100 text-blue-800 py-1 px-2 rounded-full inline-block min-w-[28px] text-center">
                            {client.checkIns || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium bg-green-100 text-green-800 py-1 px-2 rounded-full inline-block min-w-[28px] text-center">
                            {client.freeCuts || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => checkIn(client._id)}
                            className={`text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 ${loadingCheckins[client._id] ? 'opacity-75 cursor-not-allowed' : ''}`}
                            disabled={loadingCheckins[client._id]}
                          >
                            {loadingCheckins[client._id] ? (
                              <>
                                <svg className="h-4 w-4 mr-1 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processando...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Check-in
                              </>
                            )}
                          </button>


                          {client.freeCuts > 0 && (
                            <button
                              onClick={() => useFreeCut(client._id)}
                              className={`text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 ${loadingFreeCuts[client._id] ? 'opacity-75 cursor-not-allowed' : ''}`}
                              disabled={loadingFreeCuts[client._id]}
                            >
                              {loadingFreeCuts[client._id] ? (
                                <>
                                  <svg className="h-4 w-4 mr-1 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processando...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                  </svg>
                                  Usar Corte
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Versão para mobile - cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredClients.map(client => (
                  <div key={client._id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{client.name || "N/A"}</h3>
                        <p className="text-sm text-gray-500">{client.nickname || "N/A"}</p>
                      </div>
                      <div className="flex space-x-2">
                        <div className="text-sm font-medium bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                          {client.checkIns || 0} ✓
                        </div>
                        <div className="text-sm font-medium bg-green-100 text-green-800 py-1 px-2 rounded-full">
                          {client.freeCuts || 0} ✂️
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => checkIn(client._id)}
                        className={`flex-1 text-white bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium flex items-center justify-center gap-1 ${loadingCheckins[client._id] ? 'opacity-75 cursor-not-allowed' : ''}`}
                        disabled={loadingCheckins[client._id]}
                      >
                        {loadingCheckins[client._id] ? (
                          <>
                            <svg className="h-4 w-4 mr-1 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processando...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Check-in
                          </>
                        )}
                      </button>
                      {client.freeCuts > 0 && (
                        <button
                          onClick={() => useFreeCut(client._id)}
                          className={`flex-1 text-white bg-green-500 hover:bg-green-600 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium flex items-center justify-center gap-1 ${loadingFreeCuts[client._id] ? 'opacity-75 cursor-not-allowed' : ''}`}
                          disabled={loadingFreeCuts[client._id]}
                        >
                          {loadingFreeCuts[client._id] ? (
                            <>
                              <svg className="h-4 w-4 mr-1 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processando...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                              </svg>
                              Usar Corte
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>


            </div>
          )}
        </div>
      </main>
    </>
  );
}

