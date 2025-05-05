import connectDB from "@/config/db";
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

export async function GET(req){
    try {
        const {userId} = getAuth(req)

        if(!userId){
            return NextResponse.json({
                success: false,
                message: "Usuario não autenticado",
            })
        }
      
        // Conectar com o banco e criar um novo chat
        await connectDB();
        const data = await Chat.find({userId});

        return NextResponse.json({success: true, data})

    } catch (error) {
        return NextResponse.json({success: false, error: error.message});
    }
}