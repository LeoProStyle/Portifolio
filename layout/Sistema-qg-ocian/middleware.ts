import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionRole, isAdminPath } from "@/lib/auth";

/** Todo o sistema exige login. Admin, Dashboard e suas APIs exigem o login do dono. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = await getSessionRole(req.cookies.get(SESSION_COOKIE)?.value);
  const needsAdmin = isAdminPath(pathname);

  if (role === "admin" || (role === "staff" && !needsAdmin)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return role
      ? NextResponse.json({ error: "Acesso restrito ao dono." }, { status: 403 })
      : NextResponse.json({ error: "Não autorizado. Faça login." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  if (role) url.searchParams.set("admin", "1");
  return NextResponse.redirect(url);
}

export const config = {
  // tudo, menos: login, APIs de login/logout, health check e arquivos do Next/estáticos
  matcher: ["/((?!login|api/auth|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest)$).*)"],
};
