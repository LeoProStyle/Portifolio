import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { openai, EMBEDDING_MODEL } from "@/lib/openai";

export async function GET() {
  const results: Record<string, any> = { env: {}, checks: {} };

  try {
    results.env.OPENAI_API_KEY = Boolean(process.env.OPENAI_API_KEY);
    results.env.MONGODB_URI = Boolean(process.env.MONGODB_URI);
    results.env.MONGODB_DB = process.env.MONGODB_DB || "chat-with-docs";
  } catch {}

  // MongoDB check
  try {
    const db = await getDb();
    const ping = await db.command({ ping: 1 });
    const documents = db.collection("documents");
    const count = await documents.countDocuments();
    const sample = count > 0 ? await documents.find({}, { projection: { _id: 0, source: 1, content: 1, embedding: { $slice: 3 } } }).limit(1).toArray() : [];

    // Detecta índice vetorial (Atlas) se existir
    let vectorIndexExists: boolean | undefined = undefined;
    try {
      const cur = documents.aggregate([{ $listSearchIndexes: { name: "vector_index" } }]);
      const idx = await cur.toArray();
      vectorIndexExists = Array.isArray(idx) && idx.length > 0;
    } catch {
      vectorIndexExists = undefined; // ambiente pode não suportar este comando
    }

    results.checks.mongodb = { ok: true, ping, documents: { count, sample, vectorIndexExists } };
  } catch (err: any) {
    results.checks.mongodb = { ok: false, error: err?.message || String(err) };
  }

  // OpenAI check (very small embedding request)
  try {
    const emb = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: "ok" });
    results.checks.openai = { ok: true, dim: emb.data?.[0]?.embedding?.length };
  } catch (err: any) {
    results.checks.openai = { ok: false, error: err?.message || String(err) };
  }

  const status = Object.values(results.checks).every((c: any) => c?.ok) ? 200 : 500;
  return NextResponse.json(results, { status });
}


