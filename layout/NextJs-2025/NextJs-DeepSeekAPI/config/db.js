import mongoose from "mongoose";

// Usa cache global para evitar múltiplas conexões em dev
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectDB() {
  if (cached.conn) {
    console.log("MongoDB já conectado.");
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("Conectando ao MongoDB...");
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then((mongoose) => {
        console.log("Conectado ao MongoDB com sucesso!");
        return mongoose;
      })
      .catch((err) => {
        console.error("Erro ao conectar ao MongoDB:", err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    console.error("Erro ao resolver a promise do MongoDB:", error);
    throw error;
  }

  return cached.conn;
}