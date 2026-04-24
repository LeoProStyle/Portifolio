import path from "path";
import { loadPDF } from "@/lib/pdfLoader";
import { chunkText } from "@/lib/textChunker";
import { search } from "@/lib/search";
import { askOllama } from "@/lib/ollama";

let cachedChunks = null;

export async function POST(req) {
  const { question } = await req.json();

  if (!cachedChunks) {
    const filePath = path.join(process.cwd(), "data/documento.pdf");
    const text = await loadPDF(filePath);
    cachedChunks = chunkText(text);
  }

  const results = search(question, cachedChunks);
  const context = results.map(r => r.chunk).join("\n\n");

  const prompt = `
Você é um assistente que responde baseado no documento abaixo.

CONTEXTO:
${context}

PERGUNTA:
${question}

Responda de forma clara e direta:
`;

  const answer = await askOllama(prompt);

  return Response.json({ answer });
}