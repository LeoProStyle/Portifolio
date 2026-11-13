/**
 * Cria o banco da loja (MONGODB_DB) com as coleções e índices.
 * Uso: npm run db:init
 */
import { connectDB, DB_NAME } from "../lib/db";
import { Product } from "../models/Product";
import { DailyRegister } from "../models/DailyRegister";

async function main() {
  const conn = await connectDB();
  for (const m of [Product, DailyRegister]) {
    await m.createCollection().catch(() => undefined);
    await m.syncIndexes();
    console.log(`✔ ${m.collection.collectionName}`);
  }
  console.log(`Banco "${DB_NAME}" pronto.`);
  await conn.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
