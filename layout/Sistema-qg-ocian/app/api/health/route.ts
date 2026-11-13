import { connectDB, DB_NAME } from "@/lib/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Verifica se o app consegue falar com o MongoDB. */
export async function GET() {
  const started = Date.now();
  try {
    const conn = await connectDB();
    await conn.connection.db?.admin().ping();
    return json({ ok: true, db: DB_NAME, latencyMs: Date.now() - started });
  } catch (err) {
    console.error("[health]", err);
    return json({ ok: false, error: "Sem conexão com o banco de dados." }, 503);
  }
}
