import { search } from "@/lib/search";
import { askOllama } from "@/lib/ollama";
import { getChunks, studyDocument } from "@/lib/knowledgeBase";

/**
 * Recebe uma pergunta, busca os melhores trechos do documento
 * e gera a resposta final via Ollama.
 *
 * @param {Request} req Requisicao HTTP contendo `{ question }`.
 * @returns {Promise<Response>} Resposta JSON com `answer` ou erro validado.
 */
export async function POST(req) {
  const { question } = await req.json();

  if (!question?.trim()) {
    return Response.json({ error: "Pergunta inválida." }, { status: 400 });
  }

  const chunks = getChunks() || (await studyDocument());
  const results = search(question, chunks);
  const bestScore = results[0]?.score ?? 0;

  if (bestScore <= 0) {
    return Response.json({
      answer: "este conteudo nao esta no meu banco de dados no momento",
    });
  }

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