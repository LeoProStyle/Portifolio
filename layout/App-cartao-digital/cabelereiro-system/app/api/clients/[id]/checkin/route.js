import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";

export async function POST(request, context) {
  const { params } = context;
  await connectDB();
  const client = await Client.findById(params.id);

  if (!client) {
    return Response.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Incrementa o check-in
  client.checkIns += 1;

  // Verifica se atingiu 10 cortes
  if (client.checkIns >= 10) {
    client.checkIns = 0; // Zera os check-ins
    client.freeCuts = (client.freeCuts || 0) + 1; // Incrementa o corte grátis
  }

  // Salva as mudanças no cliente
  await client.save();

  return Response.json(client);
}