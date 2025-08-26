import { NextResponse } from "next/server";
import { getCollection, DocumentChunk } from "@/lib/mongodb";
import { openai, CHAT_MODEL, EMBEDDING_MODEL } from "@/lib/openai";

type ChatBody = {
	question: string;
	topK?: number;
	source?: string;
};

async function searchSimilar(embedding: number[], topK: number, source?: string) {
	const collection = await getCollection<DocumentChunk>("documents");

	// Filtro por source se especificado
	const matchStage = source ? [{ $match: { source } }] : [];

	// Tenta usar Atlas Vector Search ($vectorSearch). Requer índice chamado "vector_index".
	try {
		const results = (await collection
			.aggregate([
				...matchStage,
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
		// Fallback: busca com similaridade calculada em JavaScript (para MongoDB < 7.0)
		const allDocs = (await collection
			.aggregate([
				...matchStage,
				{ $project: { content: 1, source: 1, embedding: 1 } },
			])
			.toArray()) as Array<DocumentChunk>;
		
		// Calcula similaridade cosseno para cada documento
		const docsWithScore = allDocs.map(doc => {
			const score = cosineSimilarity(embedding, doc.embedding);
			return { ...doc, score };
		});
		
		// Ordena por score e retorna topK
		return docsWithScore
			.sort((a, b) => (b.score || 0) - (a.score || 0))
			.slice(0, topK);
	}
}

// Função para calcular similaridade cosseno
function cosineSimilarity(vecA: number[], vecB: number[]): number {
	if (vecA.length !== vecB.length) return 0;
	
	const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
	const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
	const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
	
	if (magnitudeA === 0 || magnitudeB === 0) return 0;
	return dotProduct / (magnitudeA * magnitudeB);
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as ChatBody;
		const question = (body.question || "").toString();
		const topK = Math.min(Math.max(body.topK || 4, 1), 10);
		const source = body.source;

		if (!question || question.trim().length < 3) {
			return NextResponse.json({ error: "Pergunta vazia ou muito curta." }, { status: 400 });
		}

		const embed = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: question });
		const queryVector = embed.data[0].embedding as unknown as number[];

		const matches = await searchSimilar(queryVector, topK, source);
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


