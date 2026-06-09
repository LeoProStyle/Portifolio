import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import mongoose from 'mongoose';

import { connectToMongo } from '../lib/mongodb.js';


import { CashClosureModel } from '../models/CashClosure';
import { ExpenseModel } from '../models/Expense';

function ymd(d: Date) {
  const year = d.getFullYear().toString();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log('[SMOKE] start');
  console.log('[SMOKE] MONGODB_URI exists:', Boolean(process.env.MONGODB_URI));
  console.log('[SMOKE] MONGODB_DB:', process.env.MONGODB_DB);

  await connectToMongo();
  console.log('[SMOKE] connected');

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthRegex = `^${year}-${month}-`;

  console.log('[SMOKE] monthRegex:', monthRegex);

  const before = {
    closures: await CashClosureModel.countDocuments({ date: { $regex: monthRegex } }),
    expenses: await ExpenseModel.countDocuments({ date: { $regex: monthRegex } }),
  };
  console.log('[SMOKE] before counts:', before);

  // Limpa apenas o mês atual (para não acumular)
  await Promise.all([
    CashClosureModel.deleteMany({ date: { $regex: monthRegex } }),
    ExpenseModel.deleteMany({ date: { $regex: monthRegex } }),
  ]);

  const cleared = {
    closures: await CashClosureModel.countDocuments({ date: { $regex: monthRegex } }),
    expenses: await ExpenseModel.countDocuments({ date: { $regex: monthRegex } }),
  };
  console.log('[SMOKE] after clear counts:', cleared);

  const closure1Date = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const closure2Date = ymd(new Date(now.getFullYear(), now.getMonth(), 15));

  const c1 = await CashClosureModel.create({
    date: closure1Date,
    dinheiro: 100,
    pix: 200,
    cartao_credito: 300,
    cartao_debito: 400,
    observacao: 'Smoke test v2 - 1',
    createdBy: 'smoke-test-v2',
    total: 0,
  });

  c1.total = (c1.dinheiro ?? 0) + (c1.pix ?? 0) + (c1.cartao_credito ?? 0) + (c1.cartao_debito ?? 0);
  await c1.save();

  const c2 = await CashClosureModel.create({
    date: closure2Date,
    dinheiro: 10,
    pix: 20,
    cartao_credito: 30,
    cartao_debito: 40,
    observacao: 'Smoke test v2 - 2',
    createdBy: 'smoke-test-v2',
    total: 0,
  });

  c2.total = (c2.dinheiro ?? 0) + (c2.pix ?? 0) + (c2.cartao_credito ?? 0) + (c2.cartao_debito ?? 0);
  await c2.save();

  await ExpenseModel.create({
    date: ymd(new Date(now.getFullYear(), now.getMonth(), 3)),
    category: 'Internet',
    description: 'Smoke test v2 - Internet',
    amount: 123.45,
    createdBy: 'smoke-test-v2',
  });

  await ExpenseModel.create({
    date: ymd(new Date(now.getFullYear(), now.getMonth(), 20)),
    category: 'Funcionários',
    description: 'Smoke test v2 - Funcionários',
    amount: 200,
    createdBy: 'smoke-test-v2',
  });

  const closures = await CashClosureModel.find({ date: { $regex: monthRegex } }).sort({ date: 1 }).lean();
  const expenses = await ExpenseModel.find({ date: { $regex: monthRegex } }).sort({ date: 1 }).lean();

  console.log('[SMOKE] after insert counts:', {
    closures: closures.length,
    expenses: expenses.length,
  });

  console.log(
    '[SMOKE] closures sample:',
    closures.map((c: { date: string; total: number }) => ({ date: c.date, total: c.total }))
  );
  console.log(
    '[SMOKE] expenses sample:',
    expenses.map((e: { date: string; amount: number }) => ({ date: e.date, amount: e.amount }))
  );


  const totalEntrada = closures.reduce(
    (s: number, c: { total?: number }) => s + (c.total ?? 0),
    0
  );
  const totalDespesas = expenses.reduce(
    (s: number, e: { amount?: number }) => s + (e.amount ?? 0),
    0
  );


  console.log('[SMOKE] computed totals:', {
    totalEntrada,
    totalDespesas,
    lucroEstimado: totalEntrada - totalDespesas,
  });

  console.log('[SMOKE] OK');
}

main()
  .catch(async (e) => {
    console.error('[SMOKE] FAILED', e);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  })
  .then(async () => {
    try {
      await mongoose.connection.close();
    } catch {}
  });

