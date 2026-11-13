"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { post } from "@/lib/client";
import { safeNextPath } from "@/lib/auth";

export function LoginForm() {
  const params = useSearchParams();
  const ownerOnly = params.get("admin") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post("/api/auth/login", { username, password });
      // navegação completa: garante que o middleware já receba o cookie novo
      window.location.assign(safeNextPath(params.get("next")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-ink">
          <LockKeyhole aria-hidden />
        </span>
        <h1 className="mt-3 text-xl font-extrabold">{ownerOnly ? "Área do dono" : "Entrar no QG Ocian"}</h1>
        <p className="text-sm text-muted">
          {ownerOnly ? "Admin e Dashboard exigem o login do dono" : "Faça login para acessar o sistema"}
        </p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Usuário</span>
        <input
          className={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Senha</span>
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-ink py-3 font-bold text-bg disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
      {ownerOnly && (
        <Link href="/saida" className="block text-center text-sm font-semibold text-muted hover:text-ink">
          Voltar para Saída de produtos
        </Link>
      )}
    </form>
  );
}
