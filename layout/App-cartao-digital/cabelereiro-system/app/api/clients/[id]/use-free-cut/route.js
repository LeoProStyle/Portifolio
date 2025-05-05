import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

export async function POST(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (!params.id) {
      return NextResponse.json({ error: "ID do cliente não fornecido" }, { status: 400 });
    }

    await connectDB();

    // Busca o cliente e seleciona todos os campos
    const client = await Client.findById(params.id).select('+userId +name +nickname +checkIns +freeCuts');
    
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Verifica se o cliente tem cortes grátis disponíveis
    const currentFreeCuts = client.freeCuts || 0;
    if (currentFreeCuts <= 0) {
      return NextResponse.json({ error: "Nenhum corte grátis disponível" }, { status: 400 });
    }

    try {
      // Atualiza o cliente usando findByIdAndUpdate para evitar problemas de validação
      const updatedClient = await Client.findByIdAndUpdate(
        params.id,
        {
          $set: {
            freeCuts: currentFreeCuts - 1,
            name: client.name || "N/A",
            nickname: client.nickname || "N/A",
            checkIns: client.checkIns || 0
          }
        },
        { new: true, runValidators: false }
      );

      if (!updatedClient) {
        return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
      }

      return NextResponse.json(updatedClient);
    } catch (updateError) {
      console.error('Erro ao atualizar cliente:', updateError);
      return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/clients/[id]/use-free-cut:', error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
