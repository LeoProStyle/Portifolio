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
    
    // Busca o cliente e seleciona todos os campos
    const client = await Client.findById(params.id).select('+userId +name +nickname +checkIns +freeCuts');
    
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    try {
      // Atualiza os campos numéricos
      const checkIns = (client.checkIns || 0) + 1;
      const freeCuts = client.freeCuts || 0;

      // Atualiza o cliente usando findByIdAndUpdate para evitar problemas de validação
      const updatedClient = await Client.findByIdAndUpdate(
        params.id,
        {
          $set: {
            checkIns: checkIns >= 10 ? 0 : checkIns,
            freeCuts: checkIns >= 10 ? freeCuts + 1 : freeCuts,
            name: client.name || "N/A",
            nickname: client.nickname || "N/A"
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
    console.error('Error in POST /api/clients/[id]/checkin:', error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}