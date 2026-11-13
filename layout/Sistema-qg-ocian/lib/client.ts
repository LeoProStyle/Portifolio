/** fetch para as telas: devolve JSON ou lança Error com a mensagem da API. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { body?: BodyInit | null }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new HttpError(0, "Sem conexão. Verifique a internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, (data as { error?: string }).error ?? "Algo deu errado.");
  return data as T;
}

export const post = <T>(url: string, body: unknown) => api<T>(url, { method: "POST", body: JSON.stringify(body) });
