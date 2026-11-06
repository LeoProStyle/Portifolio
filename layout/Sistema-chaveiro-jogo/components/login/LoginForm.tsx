'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeCallbackUrl } from '@/lib/safe-callback-url';

type LoginFormProps = {
  /** Computed on the server by getAdminLoginHint; null hides the line. */
  hint: string | null;
};

// One message for a wrong password and for a locked login (429), so the screen does not reveal the lock.
const GENERIC_ERROR = 'Credenciais inválidas.';

export default function LoginForm({ hint }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const username = formData.get('username')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'), window.location.origin);

    console.info('[login] attempt', { callbackUrl });

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false
      });

      if (!result) {
        console.error('[login] signIn returned no result');
        setError('Erro ao processar login.');
        setLoading(false);
        return;
      }

      if (result.error || !result.ok || result.status === 429) {
        console.error('[login] signIn failed', { status: result.status });
        setError(GENERIC_ERROR);
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

      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}

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
