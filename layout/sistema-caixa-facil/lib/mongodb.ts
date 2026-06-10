import mongoose from "mongoose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

declare global {
  var mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

global.mongooseConn = global.mongooseConn || { conn: null, promise: null };

export async function connectToMongo(): Promise<typeof mongoose> {
  const MONGODB_URI = requireEnv("MONGODB_URI");
  const MONGODB_DB = requireEnv("MONGODB_DB");

  if (global.mongooseConn.conn) {
    console.log("[MongoDB] Using cached connection");
    return global.mongooseConn.conn;
  }

  if (!global.mongooseConn.promise) {
    console.log("[MongoDB] Establishing new connection...");
    global.mongooseConn.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
      })
      .then((m) => {
        console.log("[MongoDB] ✅ Connected successfully to", MONGODB_DB);
        global.mongooseConn.conn = m;
        return m;
      })
      .catch((err) => {
        console.error("[MongoDB] ❌ Connection failed:", err.message);
        global.mongooseConn.promise = null;
        throw err;
      });
  }
  return global.mongooseConn.promise;
}


