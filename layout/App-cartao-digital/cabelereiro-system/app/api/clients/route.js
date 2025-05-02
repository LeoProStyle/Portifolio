import { connectDB } from "@/lib/mongoose";
import { Client } from "@/models/Client";

export async function GET() {
  await connectDB();
  const clients = await Client.find();
  return Response.json(clients);
}

export async function POST(request) {
  await connectDB();
  const body = await request.json();
  const newClient = await Client.create({ name: body.name });
  return Response.json(newClient);
}
