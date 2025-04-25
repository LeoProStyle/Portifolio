import {Webhook} from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(req){
    const wh = new Webhook(process.env.SIGNING_SECRET)
    const headerPayload = await headers()
    const svixHeaders = {
        "svix-id": headerPayload.get("svix-id"),
        "svix-signature": headerPayload.get("svix-signature")
    };

    //pega o payload e verifica isso
    const payload = await req.json();
    const body = JSON.stringify(payload);
    const {data, type} = whverify(body, svixHeaders)

    //prepara o dados do usuario para salvar no banco

    const userData = {
    _id: data.id,
    email: data.email_addresses[0].email_address,
    name: `${data.first_name} ${data.last_name}`,
    image: data.image_url,
    };

    await connectDB();

    switch (type) {
        case 'user.created':
            await User.create(userData)
            break;

        case 'user.updated':
            await User.findByIdAndUpdate(data.id, userData)
            break;

        case 'user.deleted':
            await User.findByIdAndDelete(data.id)
            break;

        default:
            break;
    }

    return NextRequest.json()
}