import connectDB from "@/config/db";
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(req){
    try {
        const {userId} = getAuth(req)

        if(!userId){
            return NextResponse.json({
                success: false,
                message: "Usuario não autenticado",
            });
        }
        
        const{chatId, name} = await req.json();
        //conectar o banco e update do chat
        await Chat.FindOndeAndUpdate({_id: chatId, userId}, {name});
        

        return NextResponse.json({success: true, message: "Chat Rebomeado!"});

    } catch (error) {
        return NextResponse.json({success: false, error: error.message});
    }
}