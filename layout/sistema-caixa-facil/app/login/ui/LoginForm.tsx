"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    return email.trim().length > 3 && senha.trim().length >= 4;
  }, [email, senha]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      setError("Informe um email válido e uma senha.");
      return;
    }

    // MVP: validação mock (sem banco ainda) apenas para telas ficarem prontas.
    // Estrutura preparada para substituir por API + Mongo.
    setLoading(true);
    try {
      // Regra simples: se email terminar com @admin.com => admin; senão operador
      const role = email.toLowerCase().endsWith("@admin.com") ? "admin" : "operador";

      localStorage.setItem(
        "caixaFacil.session",
        JSON.stringify({
          email,
          role,
          at: new Date().toISOString(),
        })
      );

      router.push(role === "admin" ? "/dashboard" : "/dashboard");
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
        <input
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          placeholder="••••••••"
          minLength={4}
        />
      </div>

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      <button
        disabled={!isValid || loading}
        type="submit"
        className="w-full rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Dica do MVP: use qualquer email + senha (min 4). Email terminando com <b>@admin.com</b> vira admin.
      </div>
    </form>
  );
}

