"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Swal from "sweetalert2";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Atenção",
        text: "Email e senha são obrigatórios",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        Swal.fire({
          icon: "error",
          title: "Erro no Login",
          text: result.error,
        });
        return;
      }

      if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao fazer login";
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white dark:bg-zinc-900 p-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          placeholder="voce@empresa.com"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Senha</label>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-2 text-xs text-zinc-500">
            {showPassword ? "Ocultar" : "Ver"}
          </button>
        </div>
        
      </div>

      <button
        disabled={loading}
        type="submit"
        className="w-full rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        Autenticação segura com NextAuth.js
      </div>
    </form>
  );
}

