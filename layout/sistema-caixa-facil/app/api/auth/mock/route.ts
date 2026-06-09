import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    senha?: string;
  };

  const email = (body.email ?? "").toString().trim();
  const senha = (body.senha ?? "").toString();

  if (!email.includes("@") || senha.trim().length < 4) {
    return NextResponse.json({ ok: false, error: "Credenciais inválidas" }, { status: 400 });
  }

  const role = email.toLowerCase().endsWith("@admin.com") ? "admin" : "operador";

  // MVP mock: retorna role apenas para o frontend ficar estruturado.
  return NextResponse.json({ ok: true, role });
}

