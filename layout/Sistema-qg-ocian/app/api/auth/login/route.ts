import { z } from "zod";
import { handler, json, ApiError } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { checkAdminCredentials } from "@/lib/credentials";

const Body = z.object({
  username: z.string().trim().min(1, "Informe o usuário").max(100),
  password: z.string().min(1, "Informe a senha").max(200),
});

export const POST = handler(async (req: Request) => {
  const { username, password } = Body.parse(await req.json());
  if (!checkAdminCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativas em sequência
    throw new ApiError(401, "Usuário ou senha incorretos.");
  }
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
