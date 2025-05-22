'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Utensils } from 'lucide-react';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value);
    setError('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.trim() === '') {
      setError('Digite seu PIN');
      return;
    }

    const success = login(pin);
    
    if (success) {
      toast.success('Login realizado com sucesso!');
      router.push('/');
    } else {
      setError('PIN inválido');
      toast.error('PIN inválido');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Utensils className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Sistema de Lanchonete</h1>
          <p className="text-muted-foreground mt-2">Faça login para acessar o sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="pin" className="block text-sm font-medium">
              PIN de Acesso
            </label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={handlePinChange}
              className={`w-full px-4 py-3 rounded-md border ${
                error ? 'border-red-500' : 'border-input'
              } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
              placeholder="Digite seu PIN"
              maxLength={4}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Entrar
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Para demonstração, use:</p>
          <div className="mt-2 space-y-1">
            <p>Garçom: 1234 | Bar: 2345</p>
            <p>Cozinha: 3456 | Caixa: 4567</p>
            <p>Admin: 0000</p>
          </div>
        </div>
      </div>
    </div>
  );
}