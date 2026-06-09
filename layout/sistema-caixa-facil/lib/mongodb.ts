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
  const MONGODB_URI = requireEnv('MONGODB_URI');
  const MONGODB_DB = requireEnv('MONGODB_DB');

  if (global.mongooseConn.conn) return global.mongooseConn.conn;
  if (!global.mongooseConn.promise) {
    global.mongooseConn.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
      })
      .then((m) => {
        global.mongooseConn.conn = m;
        return m;
      });
  }
  return global.mongooseConn.promise;
}


