import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

export async function POST(request, context) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { params } = context;
    if (!params.id) {
      return NextResponse.json({ error: "ID do cliente não fornecido" }, { status: 400 });
    }

    await connectDB();
    
    // Busca o cliente
    const client = await Client.findById(params.id);
    
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Reset do contador e incremento do corte grátis
    const updatedClient = await Client.findByIdAndUpdate(
      params.id,
      {
        $set: {
          checkIns: 0,  // Resetamos os check-ins
          freeCuts: (client.freeCuts || 0) + 1,  // Incrementamos o corte grátis
          checkinDates: []  // Limpamos o array de datas de check-in
        }
      },
      { new: true, runValidators: false }
    );

    return NextResponse.json(updatedClient);

  } catch (error) {
    console.error('Erro ao resetar cartão:', error);
    return NextResponse.json({ error: "Erro ao resetar cartão" }, { status: 500 });
  }
}