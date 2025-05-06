// app/client/page.js
'use client';

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export default function ClientPage() {
  const { user, isLoaded } = useUser();
  const [nickname, setNickname] = useState("");
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Carregar dados do cliente
    const loadClientData = async () => {
      try {
        const response = await fetch(`/api/clients/user/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setClientData(data);
            setNickname(data.nickname || "");
          } else {
            setIsNewUser(true);
          }
        } else {
          setIsNewUser(true);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setIsNewUser(true);
        setIsLoading(false);
      }
    };

    loadClientData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch("/api/clients/profile", {
        method: clientData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          userId: user.id,
          name: user.fullName || user.firstName + " " + user.lastName || user.emailAddresses[0].emailAddress
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar dados");
      }

      setClientData(data.client || data);
      setIsNewUser(false);
      setFeedback({
        type: 'success',
        message: data.message || 'Apelido salvo com sucesso!'
      });
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao salvar o apelido'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Área do Cliente
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">
            Meus Agendamentos
          </h2>
          {/* Conteúdo dos agendamentos */}
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">
            Meu Perfil
          </h2>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl mb-4">
              {isNewUser ? (
                <>Bem-vindo ao nosso sistema, {user?.firstName || user?.emailAddresses[0].emailAddress}!</>
              ) : (
                <>Bem-vindo de volta, {user?.firstName || user?.emailAddresses[0].emailAddress}!</>
              )}
            </h2>

            {isNewUser && (
              <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-md">
                <p>É seu primeiro acesso! Por favor, escolha um apelido para continuar.</p>
                <p className="text-sm mt-1">O apelido será usado para identificar você no sistema.</p>
              </div>
            )}

            {feedback.message && (
              <div className={`mb-4 p-4 rounded-md ${
                feedback.type === 'error' 
                  ? 'bg-red-50 text-red-700' 
                  : 'bg-green-50 text-green-700'
              }`}>
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                  {isNewUser ? "Escolha seu Apelido" : "Seu Apelido"}
                </label>
                <input
                  type="text"
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Como você quer ser chamado?"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 px-4 rounded-md transition-colors ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isSubmitting 
                  ? 'Salvando...' 
                  : isNewUser 
                    ? "Salvar Apelido" 
                    : "Atualizar Apelido"
                }
              </button>
            </form>

            {clientData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="text-lg font-medium mb-2">Seus Check-ins</h3>
                <p>Total de check-ins: {clientData.checkIns || 0}</p>
                <p>Cortes grátis disponíveis: {clientData.freeCuts || 0}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
