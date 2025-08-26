import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
	throw new Error("OPENAI_API_KEY não está definida nas variáveis de ambiente.");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";


