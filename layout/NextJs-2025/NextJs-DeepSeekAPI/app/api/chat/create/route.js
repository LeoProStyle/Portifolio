import connectDB from "@/config/db";
import User from '@/models/Chat';
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(req){
    try {
        const {userId} = getAuth(req)

        if(!userId){
            return NextResponse.json({success: false, message: "Usuario não autenticado",})
        }
        //preparar os dados do chat para salvar no banco de dados.
        const chatData = {
            userId,
            messages: [],
            name: "Novo Chat",
        };
        // Conectar com o banco e criar um novo chat
        await connectDB();
        await Chat.create(chatData);

        return NextResponse.json({success: true, message: "Chat Criado!"})

    } catch (error) {
        return NextResponse.json({success: false, error: error.message});
    }
}