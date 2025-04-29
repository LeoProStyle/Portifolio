import { NextResponse } from 'next/server';
import connectDB from "@/config/db"; // ajuste o caminho conforme sua estrutura
import User from '@/models/User';

export async function GET() {
  await connectDB();

  try {
    const newUser = await User.create({
      _id: "user001",
      name: "Augusto Prostyle",
      email: "augusto@email.com",
      image: "https://example.com/image.jpg"
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}