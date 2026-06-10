#!/usr/bin/env node
import mongoose from "mongoose";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

async function testConnection() {
  console.log("🔍 Testing MongoDB Connection...\n");
  console.log("URI:", process.env.MONGODB_URI?.substring(0, 50) + "...");
  console.log("DB:", process.env.MONGODB_DB);
  console.log("");

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "", {
      dbName: process.env.MONGODB_DB,
    });

    console.log("✅ Connected successfully!");
    console.log("Host:", conn.connection.host);
    console.log("DB Name:", conn.connection.db?.databaseName);

    // List collections
    const collections = await conn.connection.db?.listCollections().toArray();
    console.log("\n📊 Collections:");
    if (collections && collections.length > 0) {
      for (const col of collections) {
        const count = await conn.connection.collection(col.name).countDocuments();
        console.log(`  - ${col.name}: ${count} documents`);
      }
    } else {
      console.log("  (No collections found)");
    }

    await mongoose.disconnect();
    console.log("\n✅ Connection test passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed!");
    console.error(error);
    process.exit(1);
  }
}

testConnection();
