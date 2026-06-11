#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { connectToMongo } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

dotenv.config({ path: ".env.local" });

async function run() {
  const email = process.argv[2] || "qgocian@gmail.com";
  const newPassword = process.argv[3] || "Hot13ici*";

  await connectToMongo();
  const user = await UserModel.findOne({ email });
  if (!user) {
    console.error("Usuário não encontrado:", email);
    process.exit(1);
  }

  user.password = newPassword;
  await user.save();
  console.log(`Senha atualizada para ${email}`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
