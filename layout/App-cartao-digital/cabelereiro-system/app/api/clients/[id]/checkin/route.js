import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import mongoose from "mongoose";

export async function POST(request, context) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { params } = context;
    if (!params.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "ID inválido ou não fornecido" }, { status: 400 });
    }

    await connectDB();

    const client = await Client.findById(params.id).select('+checkIns +freeCuts +name +nickname +checkinDates');
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    let newCheckIns = (client.checkIns || 0) + 1;
    let newFreeCuts = client.freeCuts || 0;
    const today = new Date().toISOString().split('T')[0];

    let updateFields = {
      name: client.name || "N/A",
      nickname: client.nickname || "N/A"
    };

    // Quando atinge exatamente 10 check-ins, zeramos e adicionamos um corte grátis
    if (newCheckIns >= 10) {
      updateFields.checkIns = 0;
      updateFields.freeCuts = newFreeCuts + 1;
      updateFields.checkinDates = [today]; // Reset do array de datas, mantendo apenas o check-in atual
    } else {
      updateFields.checkIns = newCheckIns;
      updateFields.checkinDates = [...(client.checkinDates || []), today]; // Adiciona a data atual ao array existente
    }

    const updatedClient = await Client.findByIdAndUpdate(params.id, {
      $set: updateFields
    }, { new: true, runValidators: false });

    return NextResponse.json(updatedClient);

  } catch (error) {
    console.error("Erro no check-in:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}