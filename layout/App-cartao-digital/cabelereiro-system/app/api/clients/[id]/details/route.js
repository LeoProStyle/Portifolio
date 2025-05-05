import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";

export async function GET(request, context) {
  const { params } = context;
  await connectDB();
  const client = await Client.findById(params.id);

  if (!client) {
    return Response.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Retorna os detalhes do cliente, incluindo os cortes grátis
  return Response.json({
    name: client.name,
    checkIns: client.checkIns,
    freeCuts: client.freeCuts,
  });
}
