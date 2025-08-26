import { MongoClient, Db, Collection, Document } from "mongodb";

declare global {
	
	var __mongoClient: MongoClient | undefined;
}

const mongodbUri = process.env.MONGODB_URI;
const mongodbDbName = process.env.MONGODB_DB || "chat-with-docs";

if (!mongodbUri) {
	throw new Error("MONGODB_URI não está definida nas variáveis de ambiente.");
}

let cachedClient: MongoClient | undefined = global.__mongoClient;

export async function getMongoClient(): Promise<MongoClient> {
	if (cachedClient) return cachedClient;
	const client = new MongoClient(mongodbUri!, {
		// Ajustes padrão para ambiente serverless/Vercel
		// bufferCommands não se aplica ao driver oficial, mantemos simples
	});
	await client.connect();
	global.__mongoClient = client;
	cachedClient = client;
	return client;
}

export async function getDb(): Promise<Db> {
	const client = await getMongoClient();
	return client.db(mongodbDbName);
}


export async function getCollection<T extends Document = Document>(name = "documents"): Promise<Collection<T>> {
	const db = await getDb();
	return db.collection<T>(name);
}

export type DocumentChunk = {
	content: string;
	source: string;
	embedding: number[];
};

console.log('MONGODB_URI?', !!process.env.MONGODB_URI)
