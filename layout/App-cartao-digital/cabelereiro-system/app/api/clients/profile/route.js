import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    if (!body.nickname || !body.userId || body.userId !== userId) {
      return new NextResponse("Dados inválidos", { status: 400 });
    }

    await connectDB();

    // Verifica se já existe um cliente com este userId
    const existingClient = await Client.findOne({ userId: body.userId });
    if (existingClient) {
      return new NextResponse("Cliente já existe", { status: 409 });
    }

    // Cria novo cliente
    const client = await Client.create({
      userId: body.userId,
      name: body.name,
      nickname: body.nickname,
      checkIns: 0,
      freeCuts: 0
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error in POST /api/clients/profile:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    if (!body.nickname || !body.userId || body.userId !== userId) {
      return new NextResponse("Dados inválidos", { status: 400 });
    }

    await connectDB();

    // Atualiza o cliente existente
    const client = await Client.findOneAndUpdate(
      { userId: body.userId },
      { 
        $set: { 
          nickname: body.nickname,
          name: body.name
        }
      },
      { new: true }
    );

    if (!client) {
      return new NextResponse("Cliente não encontrado", { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error in PUT /api/clients/profile:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 