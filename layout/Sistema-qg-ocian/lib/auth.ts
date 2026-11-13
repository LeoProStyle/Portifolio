import { SignJWT, jwtVerify } from "jose";

/**
 * Sessão: JWT assinado (HS256) num cookie httpOnly. Funciona no middleware (edge) e no Node.
 * - "staff": login do sistema (SIST_USERNAME/SIST_PASSWORD) — Saída e Vendas.
 * - "admin": login do dono (ADMIN_USERNAME/ADMIN_PASSWORD) — tudo, inclusive Admin e Dashboard.
 */
export type Role = "admin" | "staff";

export const SESSION_COOKIE = "qg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

/** Páginas e APIs que só o dono acessa. */
const ADMIN_PREFIXES = [
  "/admin",
  "/dashboard",
  "/api/products",
  "/api/stats",
  "/api/saida/reopen",
  "/api/finance", // fechamentos, despesas e cupons
];

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 8) throw new Error("AUTH_SECRET ausente ou muito curta.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Devolve o papel da sessão, ou null se não houver sessão válida. */
export async function getSessionRole(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.role === "admin" || payload.role === "staff" ? payload.role : null;
  } catch {
    return null;
  }
}

/** Evita redirecionamento para fora do site após o login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/saida";
  return next;
}
