import { Suspense } from 'react';
import LoginForm from '@/components/login/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold">Acesso administrativo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Entre com as credenciais configuradas no ambiente.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-slate-400">Carregando...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
