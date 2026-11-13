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

/** Baixa um arquivo gerado pela API (planilha, XML, zip). Lança HttpError com a mensagem da API se falhar. */
export async function download(url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new HttpError(0, "Sem conexão. Verifique a internet.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new HttpError(res.status, (data as { error?: string }).error ?? "Não foi possível exportar.");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "arquivo";
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
