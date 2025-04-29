import { Webhook } from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req) {
  console.log("🚀 Webhook recebido");

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const headerPayload = headers();
  const svixHeaders = {
    "svix-id": headerPayload.get("svix-id"),
    "svix-timestamp": headerPayload.get("svix-timestamp"),
    "svix-signature": headerPayload.get("svix-signature"),
  };

  const wh = new Webhook(process.env.SIGNING_SECRET);
  let evt;

  try {
    evt = wh.verify(body, svixHeaders);
  } catch (err) {
    console.error("❌ Falha na verificação da assinatura Svix:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }

  const { data, type } = evt;

  const userData = {
    _id: data.id,
    email: data.email_addresses[0]?.email_address || "sem-email@exemplo.com",
    name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Usuário",
    image: data.image_url || data.profile_image_url || "",
  };

  console.log("📨 Evento recebido:", type);
  console.log("👤 Dados do usuário:", userData);

  await connectDB();

  try {
    switch (type) {
      case "user.created":
        await User.create(userData);
        break;
      case "user.updated":
        await User.findByIdAndUpdate(data.id, userData);
        break;
      case "user.deleted":
        await User.findByIdAndDelete(data.id);
        break;
      default:
        console.log(`⚠️ Tipo de evento não tratado: ${type}`);
    }
  } catch (err) {
    console.error("❌ Erro ao salvar no MongoDB:", err);
  }

  return NextResponse.json({ received: true });
}