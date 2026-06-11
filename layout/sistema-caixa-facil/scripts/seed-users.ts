#!/usr/bin/env node
import * as dotenv from "dotenv";
import { connectToMongo } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

dotenv.config({ path: ".env.local" });

async function seedUsers() {
  console.log("🌱 Iniciando seed de usuários...\n");

  try {
    await connectToMongo();

    // Remove todos os usuários existentes e cria somente o admin
    await UserModel.deleteMany({});
    console.log("✅ Usuários antigos removidos");

    const admin = {
      email: "admin@caixafacil.com",
      name: "Administrador",
      password: "admin123",
      role: "admin",
    };

    await UserModel.create({
      email: admin.email,
      name: admin.name,
      password: admin.password,
      role: admin.role,
      active: true,
      mustResetPassword: true,
    });

    console.log("\n📝 Usuário admin criado com sucesso!");
    console.log("\n🔑 Credenciais de acesso:");
    console.log("  Admin: admin@caixafacil.com / admin123");

    // Also create the requested qgocian user with default password and force reset
    const qg = {
      email: "qgocian@gmail.com",
      name: "QgOcian",
      password: "qgocian123",
      role: "operador",
    };

    await UserModel.create({
      email: qg.email,
      name: qg.name,
      password: qg.password,
      role: qg.role,
      active: true,
      mustResetPassword: true,
    });

    console.log("  QgOcian: qgocian@gmail.com / qgocian123 (force reset on first login)");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

seedUsers();
