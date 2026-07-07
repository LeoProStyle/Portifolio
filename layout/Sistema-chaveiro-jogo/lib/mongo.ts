import { MongoClient, ServerApiVersion } from 'mongodb';

function getEnvVar(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient() {
  const uri = getEnvVar('MONGODB_URI');

  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!clientPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      }
    });

    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const mongoClient = await getMongoClient();
  return mongoClient.db(getEnvVar('MONGODB_DB') || 'retrokey');
}
