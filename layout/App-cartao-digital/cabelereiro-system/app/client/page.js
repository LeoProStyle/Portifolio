'use client';

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { FaCheckCircle } from 'react-icons/fa';
import { BiCut } from 'react-icons/bi';
import { IoGift } from 'react-icons/io5';
import { AiOutlineInfoCircle } from 'react-icons/ai'; // Importando o ícone de informação
import { Tooltip } from 'react-tooltip';

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

  // Função para formatar a data em formato brasileiro
  const formatDate = (dateString) => {
    if (!dateString) return "Data não disponível";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return "Data inválida";
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (isNewUser || !clientData?.nickname) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isNewUser ? "Bem-vindo!" : "Complete seu perfil"}
        </h2>
        
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-md">
          <p>Para começar, escolha como quer ser chamado.</p>
          <p className="text-sm mt-1">Este será seu nome no cartão de fidelidade.</p>
        </div>

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
              Seu Apelido
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Como quer ser chamado?"
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 rounded-md text-white transition-colors ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Apelido'}
          </button>
        </form>
      </div>
    );
  }

  // Calcula o número de quadrados preenchidos baseado nos check-ins
  const filledSquares = (clientData?.checkIns || 0) % 10;
  const totalSquares = 10;
  
  // Obtém as datas dos check-ins ou cria um array vazio se não houver
  const checkinDates = clientData?.checkinDates || [];

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Cartão de Fidelidade */}
        <div className="bg-gradient-to-r from-black to-orange-600 rounded-xl shadow-2xl overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
          <div className="p-6 sm:p-10">
            {/* Cabeçalho do Cartão */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Cartão Fidelidade</h3>
                <p className="text-blue-200 mt-1">Salão do Rafinha</p>
              </div>
              <FaCheckCircle className="text-white text-3xl sm:text-4xl opacity-80" />
            </div>

            {/* Nome do Cliente */}
            <div className="mb-8">
              <p className="text-blue-200 text-sm">Bem-vindo</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{clientData.nickname}</h2>
            </div>

            {/* Grid de Quadrados com Tooltips */}
            <div className="grid grid-cols-5 gap-2 sm:gap-4 mb-8">
              {[...Array(totalSquares)].map((_, index) => {
                const isFilled = index < filledSquares;
                const dateIndex = checkinDates.length - filledSquares + index;
                const checkDate = isFilled && dateIndex >= 0 ? checkinDates[dateIndex] : null;
                
                return (
                  <div
                    key={index}
                    data-tooltip-id={`check-tooltip-${index}`}
                    data-tooltip-content={checkDate ? `Check-in em: ${formatDate(checkDate)}` : ''}
                    className={`aspect-square rounded-lg flex items-center justify-center transition-all duration-300 ${
                      isFilled
                        ? 'bg-white text-blue-600 cursor-help'
                        : 'bg-blue-500/30 text-white/30'
                    }`}
                  >
                    {isFilled ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <FaCheckCircle className="text-xl sm:text-2xl" />
                        {checkDate && (
                          <AiOutlineInfoCircle 
                            className="absolute top-0 right-0 text-sm sm:text-2xl text-gray-600 bg-white rounded-full" 
                          />
                        )}
                      </div>
                    ) : (
                      <FaCheckCircle className="text-xl sm:text-2xl" />
                    )}
                    
                    {isFilled && checkDate && (
                      <Tooltip id={`check-tooltip-${index}`} place="top" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Informações */}
            <div className="flex justify-between items-center text-white">
              <div>
                <p className="text-blue-200 text-sm">Total de Cortes</p>
                <p className="text-2xl font-bold">{clientData.checkIns || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-sm">Brindes Disponíveis</p>
                <p className="text-2xl font-bold">{clientData.freeCuts || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas e Informações Adicionais */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <BiCut className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-gray-500">Próximo Corte Grátis</p>
                <p className="text-lg font-semibold">
                  Faltam {10 - filledSquares} cortes
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <IoGift className="text-purple-600 text-xl" />
              </div>
              <div>
                <p className="text-gray-500">Brindes Acumulados</p>
                <p className="text-lg font-semibold">
                  {clientData.freeCuts || 0} cortes grátis
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}