import LoginForm from "./ui/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-4 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center">
            <span className="text-xl">💳</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Caixa Fácil</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
            Entrar com email e senha
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}


