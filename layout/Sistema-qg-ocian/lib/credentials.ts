import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Compara usuário e senha com as variáveis de ambiente em tempo constante. */
export function checkAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedUser || !expectedPass) return false;
  const userOk = timingSafeEqual(digest(username), digest(expectedUser));
  const passOk = timingSafeEqual(digest(password), digest(expectedPass));
  return userOk && passOk;
}
