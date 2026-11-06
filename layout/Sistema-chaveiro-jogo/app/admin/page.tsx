'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GamesTab from '@/components/admin/GamesTab';
import CartridgesTab from '@/components/admin/CartridgesTab';
import { ADMIN_LOGIN_URL, type AdminAuthStatus } from '@/lib/admin-api';

const AUTH_ERROR_MESSAGES: Record<AdminAuthStatus, string> = {
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  403: 'Sua conta não tem permissão de administrador. Entre com a conta de admin.'
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'games' | 'cartridges'>('games');
  const [authError, setAuthError] = useState<AdminAuthStatus | null>(null);

  useEffect(() => {
    console.log('[admin] session status', status);

    if (status === 'unauthenticated') {
      console.log('[admin] redirecting to login');
      router.replace(ADMIN_LOGIN_URL);
    }
  }, [router, status]);

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Carregando painel...</p>
      </main>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Admin</p>
            <h1 className="mt-4 text-3xl font-semibold">Manage RetroKey</h1>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-400"
          >
            Sair
          </button>
        </div>

        {authError ? (
          // Replaces the tabs: unmounting them stops further admin API calls.
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p role="alert" className="text-zinc-300">
              {AUTH_ERROR_MESSAGES[authError]}
            </p>
            <button
              onClick={() => signOut({ callbackUrl: ADMIN_LOGIN_URL })}
              className="mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-400"
            >
              Entrar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 flex gap-4 border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('games')}
                className={`px-4 py-2 font-medium transition ${
                  activeTab === 'games'
                    ? 'border-b-2 border-cyan-400 text-cyan-400'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Games
              </button>
              <button
                onClick={() => setActiveTab('cartridges')}
                className={`px-4 py-2 font-medium transition ${
                  activeTab === 'cartridges'
                    ? 'border-b-2 border-cyan-400 text-cyan-400'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Cartridges
              </button>
            </div>

            <div className="mt-8">
              {activeTab === 'games' && <GamesTab onAuthError={setAuthError} />}
              {activeTab === 'cartridges' && <CartridgesTab onAuthError={setAuthError} />}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
