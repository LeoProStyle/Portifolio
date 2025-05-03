// app/client/page.js
'use client';

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export default function ClientPage() {
  const { user, isLoaded } = useUser();
  const [nickname, setNickname] = useState("");
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Carregar dados do cliente
    const loadClientData = async () => {
      try {
        const response = await fetch(`/api/clients/user/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setClientData(data);
          setNickname(data.nickname || "");
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setError("Erro ao carregar seus dados");
        setIsLoading(false);
      }
    };

    loadClientData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    try {
      const response = await fetch("/api/clients/profile", {
        method: clientData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          userId: user.id,
          name: user.fullName || user.emailAddresses[0].emailAddress
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar apelido");
      }

      const data = await response.json();
      setClientData(data);
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError("Erro ao salvar seu apelido");
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
    <main className="p-10 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">Área do Cliente</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl mb-4">
          Bem-vindo, {user?.firstName || user?.emailAddresses[0].emailAddress}!
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              Seu Apelido
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Como você quer ser chamado?"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
          >
            {clientData ? "Atualizar Apelido" : "Salvar Apelido"}
          </button>
        </form>

        {clientData && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-lg font-medium mb-2">Seus Check-ins</h3>
            <p>Total de check-ins: {clientData.checkIns}</p>
            <p>Cortes grátis disponíveis: {clientData.freeCuts}</p>
          </div>
        )}
      </div>
    </main>
  );
}
