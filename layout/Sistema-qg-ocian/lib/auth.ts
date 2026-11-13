import { SignJWT, jwtVerify } from "jose";

/** Sessão do admin: JWT assinado (HS256) num cookie httpOnly. Funciona no middleware (edge) e no Node. */
export const SESSION_COOKIE = "qg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 8) throw new Error("AUTH_SECRET ausente ou muito curta.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Evita redirecionamento para fora do site após o login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/admin";
  return next;
}
