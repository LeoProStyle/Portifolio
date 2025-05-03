import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verifica se o usuário está tentando acessar seus próprios dados
    if (userId !== params.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await connectDB();
    const client = await Client.findOne({ userId: params.id });

    if (!client) {
      return NextResponse.json(null);
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error in GET /api/clients/user/[id]:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 