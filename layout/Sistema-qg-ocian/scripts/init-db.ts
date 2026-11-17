/**
 * Cria o banco da loja (MONGODB_DB) com as coleções e índices.
 * Uso: npm run db:init
 */
import { connectDB, DB_NAME } from "../lib/db";
import { Product } from "../models/Product";
import { DailyRegister } from "../models/DailyRegister";
import { CardClosing } from "../models/CardClosing";
import { Expense } from "../models/Expense";
import { Invoice } from "../models/Invoice";
import { Sale } from "../models/Sale";
import { Counter } from "../models/Counter";
import { FiscalSettings } from "../models/FiscalSettings";
import { ProductFiscal } from "../models/ProductFiscal";

type Syncable = { createCollection(): Promise<unknown>; syncIndexes(): Promise<unknown>; collection: { collectionName: string } };

async function main() {
  const conn = await connectDB();
  const all: Syncable[] = [Product, DailyRegister, CardClosing, Expense, Invoice, Sale, Counter, FiscalSettings, ProductFiscal];
  for (const m of all) {
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
