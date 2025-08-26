import { NextResponse } from "next/server";
import { getCollection, DocumentChunk } from "@/lib/mongodb";
import { openai, EMBEDDING_MODEL } from "@/lib/openai";

type UploadBody = {
	content: string;
	source?: string;
	chunkSizeChars?: number; // fallback aproximado de 500 tokens ~ 1500-2000 chars
};

function chunkText(text: string, chunkSizeChars = 1800): string[] {
	const sentences = text
		.replace(/\r\n?/g, "\n")
		.split(/(?<=[\.\!\?])\s+/);
	const chunks: string[] = [];
	let current = "";
	for (const sentence of sentences) {
		if ((current + " " + sentence).trim().length > chunkSizeChars) {
			if (current.trim()) chunks.push(current.trim());
			current = sentence;
		} else {
			current = (current + " " + sentence).trim();
		}
	}
	if (current.trim()) chunks.push(current.trim());
	return chunks;
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as UploadBody;
		const content = (body.content || "").toString();
		const source = (body.source || "documento").toString();
		const chunkSize = body.chunkSizeChars && body.chunkSizeChars > 200 ? body.chunkSizeChars : 1800;

		if (!content || content.trim().length < 5) {
			return NextResponse.json({ error: "Conteúdo vazio ou muito curto." }, { status: 400 });
		}

		const chunks = chunkText(content, chunkSize);
		if (chunks.length === 0) {
			return NextResponse.json({ error: "Nenhum chunk gerado." }, { status: 400 });
		}

		// Gera embeddings em lote
		const embedResp = await openai.embeddings.create({
			model: EMBEDDING_MODEL,
			input: chunks,
		});

		const documents: DocumentChunk[] = chunks.map((c, i) => ({
			content: c,
			source,
			embedding: embedResp.data[i].embedding as unknown as number[],
		}));

		const collection = await getCollection<DocumentChunk>("documents");
		const result = await collection.insertMany(documents, { ordered: false });

		return NextResponse.json({
			ok: true,
			insertedCount: Object.keys(result.insertedIds).length,
			chunks: documents.length,
			source,
		});
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Erro inesperado";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}


