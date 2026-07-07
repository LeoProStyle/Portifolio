'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAdminLoginHint } from '@/lib/auth-config';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loginHint = getAdminLoginHint();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const username = formData.get('username')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    const callbackUrl = searchParams.get('callbackUrl') || '/admin';

    console.info('[login] attempt', { username, callbackUrl });

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false
      });

      if (!result) {
        console.error('[login] signIn returned no result', { username });
        setError('Erro ao processar login.');
        setLoading(false);
        return;
      }

      if (result.error) {
        console.error('[login] signIn failed', { error: result.error, username });
        setError('Credenciais inválidas.');
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch (unexpectedError) {
      console.error('[login] unexpected error', unexpectedError);
      setError('Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-4">
      <input
        name="username"
        type="text"
        placeholder="Usuário"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none ring-0"
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Senha"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none ring-0"
        required
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <p className="text-xs text-slate-500">{loginHint}</p>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-70"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
