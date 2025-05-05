import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";

export async function POST(request, { params }) {
  await connectDB();

  const client = await Client.findById(params.id);
  if (!client) {
    return Response.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Verifica se o cliente tem cortes grátis disponíveis
  if (client.freeCuts > 0) {
    client.freeCuts -= 1; // Decrementa um corte grátis
    await client.save();
    return Response.json(client); // Retorna o cliente atualizado
  } else {
    return Response.json({ error: "Nenhum corte grátis disponível" }, { status: 400 });
  }
}
