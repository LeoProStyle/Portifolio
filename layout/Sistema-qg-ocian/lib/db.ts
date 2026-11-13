import mongoose from "mongoose";

/**
 * Conexão com o MongoDB reaproveitada entre requisições.
 * Na Vercel cada função serverless pode ser reutilizada "quente"; guardar a conexão
 * no escopo global evita abrir uma conexão nova a cada chamada.
 */
type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { _mongooseCache?: MongooseCache };
const cache: MongooseCache = (globalForMongoose._mongooseCache ??= { conn: null, promise: null });

export const DB_NAME = process.env.MONGODB_DB || "Lanchonete-QgOcian";

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não configurada. Veja .env.example.");

  cache.promise ??= mongoose.connect(uri, {
    dbName: DB_NAME,
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
  });

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
