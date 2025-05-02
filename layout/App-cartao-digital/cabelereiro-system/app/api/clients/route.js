import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Função auxiliar para verificar se é admin
const isAdmin = (email) => {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  return adminEmails.includes(email);
};

export async function GET() {
  try {
    // Verifica autenticação
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Conecta ao banco de dados
    await connectDB();
    const clients = await Client.find().sort({ name: 1 });
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error in GET /api/clients:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Verifica autenticação
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Conecta ao banco de dados
    await connectDB();
    
    // Valida o corpo da requisição
    const body = await request.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return new NextResponse("Nome inválido", { status: 400 });
    }

    // Cria o cliente
    const newClient = await Client.create({ 
      name: body.name.trim(),
      checkIns: 0,
      freeCuts: 0
    });

    return NextResponse.json(newClient);
  } catch (error) {
    console.error('Error in POST /api/clients:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
