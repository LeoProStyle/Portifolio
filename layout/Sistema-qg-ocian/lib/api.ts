import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Garante que a requisição vem do admin logado (defesa além do middleware). */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value))) {
    throw new ApiError(401, "Não autorizado. Faça login.");
  }
}

/** Envolve um handler e converte erros em respostas JSON padronizadas. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError) {
        return json({ error: err.issues[0]?.message ?? "Dados inválidos", issues: err.issues }, 400);
      }
      if (typeof err === "object" && err && "code" in err && (err as { code: unknown }).code === 11000) {
        return json({ error: "Já existe um registro com esse nome." }, 409);
      }
      console.error("[api]", err);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }
  };
}
