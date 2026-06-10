import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email: string;
      name: string;
      password: string;
      role?: "admin" | "operador";
    };

    if (!body?.email || !body?.name || !body?.password) {
      return NextResponse.json(
        { ok: false, error: "Email, nome e senha são obrigatórios" },
        { status: 400 }
      );
    }

    await connectToMongo();

    // Se já existir qualquer usuário no sistema, bloqueia criação via API
    const existingAny = await UserModel.countDocuments();
    if (existingAny > 0) {
      return NextResponse.json(
        { ok: false, error: "Criação de usuários via API está desabilitada após inicialização" },
        { status: 403 }
      );
    }

    // Verifica se já existe o email (redundante, mas seguro)
    const existing = await UserModel.findOne({ email: body.email });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Usuário já existe" },
        { status: 400 }
      );
    }

    // Cria novo usuário
    const user = await UserModel.create({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role || "operador",
      active: true,
    });

    console.log("[POST /users] Created user:", user._id);

    return NextResponse.json({
      ok: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[POST /users] Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao criar usuário";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectToMongo();
    const users = await UserModel.find({}, { password: 0 }).lean();

    return NextResponse.json({
      ok: true,
      data: users,
    });
  } catch (error) {
    console.error("[GET /users] Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao listar usuários";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
