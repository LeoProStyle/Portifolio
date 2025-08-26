import { NextResponse } from "next/server";
import { getCollection, DocumentChunk } from "@/lib/mongodb";
import { openai, CHAT_MODEL, EMBEDDING_MODEL } from "@/lib/openai";

type ChatBody = {
	question: string;
	topK?: number;
};

async function searchSimilar(embedding: number[], topK: number) {
	const collection = await getCollection<DocumentChunk>("documents");

	// Tenta usar Atlas Vector Search ($vectorSearch). Requer índice chamado "vector_index".
	try {
		const results = (await collection
			.aggregate([
				{
					$vectorSearch: {
						index: "vector_index",
						path: "embedding",
						queryVector: embedding,
						numCandidates: Math.max(100, topK * 50),
						limit: topK,
					},
				},
				{ $project: { content: 1, source: 1, score: { $meta: "vectorSearchScore" } } },
			])
			.toArray()) as Array<DocumentChunk & { score?: number }>;
		return results;
	} catch {
		// Fallback: similaridade via $cosineSimilarity (MongoDB 7.0+)
		const results = (await collection
			.aggregate([
				{ $addFields: { score: { $cosineSimilarity: ["$embedding", embedding] } } },
				{ $sort: { score: -1 } },
				{ $limit: topK },
				{ $project: { content: 1, source: 1, score: 1 } },
			])
			.toArray()) as Array<DocumentChunk & { score?: number }>;
		return results;
	}
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as ChatBody;
		const question = (body.question || "").toString();
		const topK = Math.min(Math.max(body.topK || 4, 1), 10);

		if (!question || question.trim().length < 3) {
			return NextResponse.json({ error: "Pergunta vazia ou muito curta." }, { status: 400 });
		}

		const embed = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: question });
		const queryVector = embed.data[0].embedding as unknown as number[];

		const matches = await searchSimilar(queryVector, topK);
		const context = matches
			.map((m, i) => `Fonte ${i + 1} (${m.source}):\n${m.content}`)
			.join("\n\n");

		const messages = [
			{
				role: "system" as const,
				content:
					"Você é um assistente que responde em Português, com base APENAS no contexto fornecido. Se a resposta não estiver no contexto, diga que não sabe com educação. Seja conciso e objetivo.",
			},
			{
				role: "user" as const,
				content: `Contexto:\n${context || "(sem contexto)"}\n\nPergunta: ${question}`,
			},
		];

		const resp = await openai.chat.completions.create({
			model: CHAT_MODEL,
			messages,
			temperature: 0.2,
		});

		const answer = resp.choices[0]?.message?.content || "Sem resposta";

		return NextResponse.json({
			answer,
			sources: matches.map((m) => ({ content: m.content, source: m.source, score: (m as any).score })),
		});
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || "Erro inesperado" }, { status: 500 });
	}
}


