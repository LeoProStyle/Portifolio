import { createHash, timingSafeEqual } from "node:crypto";
import type { Role } from "./auth";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function matches(username: string, password: string, expectedUser = "", expectedPass = ""): boolean {
  if (!expectedUser || !expectedPass) return false;
  const userOk = timingSafeEqual(digest(username), digest(expectedUser));
  const passOk = timingSafeEqual(digest(password), digest(expectedPass));
  return userOk && passOk;
}

/** Compara usuário e senha com as variáveis de ambiente (tempo constante) e devolve o papel. */
export function checkCredentials(username: string, password: string): Role | null {
  if (matches(username, password, process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD)) return "admin";
  if (matches(username, password, process.env.SIST_USERNAME, process.env.SIST_PASSWORD)) return "staff";
  return null;
}
