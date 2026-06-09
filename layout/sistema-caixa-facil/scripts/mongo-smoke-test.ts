import 'dotenv/config';
import mongoose from 'mongoose';

import { connectToMongo } from '../lib/mongodb';
import { CashClosureModel } from '../models/CashClosure';
import { ExpenseModel } from '../models/Expense';

async function run() {
  await connectToMongo();

  // Limpando dados fictícios do mês atual (para não acumular no smoke test)
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const dateRegex = `^${year}-${month}-`;

  await Promise.all([
    CashClosureModel.deleteMany({ date: { $regex: dateRegex } }),
    ExpenseModel.deleteMany({ date: { $regex: dateRegex } }),
  ]);

  // Criar 2 fechamentos fictícios
  const closure1 = await CashClosureModel.create({
    date: `${year}-${month}-01`,
    dinheiro: 100,
    pix: 200,
    cartao_credito: 50,
    cartao_debito: 25,
    observacao: 'Smoke test - 1',
    createdBy: 'smoke-test',
    total: 0, // será sobrescrito pelo schema? (não; então calculamos abaixo)
  });

  closure1.total = (closure1.dinheiro ?? 0) + (closure1.pix ?? 0) + (closure1.cartao_credito ?? 0) + (closure1.cartao_debito ?? 0);
  await closure1.save();

  const closure2 = await CashClosureModel.create({
    date: `${year}-${month}-15`,
    dinheiro: 150,
    pix: 850,
    cartao_credito: 500,
    cartao_debito: 200,
    observacao: 'Smoke test - 2',
    createdBy: 'smoke-test',
    total: 0,
  });

  closure2.total = (closure2.dinheiro ?? 0) + (closure2.pix ?? 0) + (closure2.cartao_credito ?? 0) + (closure2.cartao_debito ?? 0);
  await closure2.save();

  // Criar 2 despesas fictícias
  await ExpenseModel.create({
    date: `${year}-${month}-03`,
    category: 'Internet',
    description: 'Smoke test - mensal',
    amount: 120,
    createdBy: 'smoke-test',
  });

  await ExpenseModel.create({
    date: `${year}-${month}-20`,
    category: 'Funcionários',
    description: 'Smoke test - ajuda custo',
    amount: 200,
    createdBy: 'smoke-test',
  });

  // Re-lendo para validar comunicação
  const closures = await CashClosureModel.find({ date: { $regex: dateRegex } }).sort({ date: 1 }).lean();
  const expenses = await ExpenseModel.find({ date: { $regex: dateRegex } }).sort({ date: 1 }).lean();

  console.log('SMOKE TEST OK');
  console.log({
    year,
    month,
    closuresCount: closures.length,
    expensesCount: expenses.length,
    closures: closures.map((c: { date: string; total: number }) => ({ date: c.date, total: c.total })),
  });


  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error('SMOKE TEST FAILED', e);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

