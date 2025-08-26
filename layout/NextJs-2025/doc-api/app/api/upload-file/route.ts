import { NextRequest, NextResponse } from "next/server";
import { getCollection, DocumentChunk } from "@/lib/mongodb";
import { openai, EMBEDDING_MODEL } from "@/lib/openai";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadFileBody = {
	content: string;
	source?: string;
	chunkSizeChars?: number;
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

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
	const extension = filename.toLowerCase().split('.').pop();
	
	switch (extension) {
		case 'docx':
		case 'doc':
			try {
				const result = await mammoth.extractRawText({ buffer });
				return result.value;
			} catch (error) {
				throw new Error(`Erro ao processar documento Word: ${error}`);
			}
		
		default:
			throw new Error(`Formato não suportado: ${extension}. Use apenas DOC ou DOCX.`);
	}
}

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const file = formData.get('file') as File;
		const source = (formData.get('source') as string) || file?.name || 'documento';
		const chunkSize = parseInt(formData.get('chunkSizeChars') as string) || 1800;

		if (!file) {
			return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
		}

		// Valida extensão - apenas DOC/DOCX por enquanto
		const allowedExtensions = ['doc', 'docx'];
		const fileExtension = file.name.toLowerCase().split('.').pop();
		if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
			return NextResponse.json({ 
				error: `Formato não suportado. Use apenas: ${allowedExtensions.join(', ')}` 
			}, { status: 400 });
		}

		// Converte File para Buffer
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Extrai texto do arquivo
		const extractedText = await extractTextFromBuffer(buffer, file.name);
		
		if (!extractedText || extractedText.trim().length < 5) {
			return NextResponse.json({ error: "Nenhum texto extraído do arquivo." }, { status: 400 });
		}

		// Processa o texto extraído
		const chunks = chunkText(extractedText, chunkSize);
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
			extractedTextLength: extractedText.length,
		});
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || "Erro inesperado" }, { status: 500 });
	}
}
