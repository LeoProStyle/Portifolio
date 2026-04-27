import { getStudyStatus, studyDocument } from "@/lib/knowledgeBase";

/**
 * Retorna o estado atual do processamento do documento.
 *
 * @returns {Promise<Response>} JSON com status, mensagem e data do ultimo estudo.
 */
export async function GET() {
  return Response.json(getStudyStatus());
}

/**
 * Dispara o estudo do documento (normal ou forcado) em background.
 *
 * @param {Request} req Requisicao HTTP com opcional `{ force: boolean }`.
 * @returns {Promise<Response>} JSON com estado atualizado ou erro de inicializacao.
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const force = Boolean(body?.force);

  try {
    void studyDocument({ force });
    return Response.json(getStudyStatus());
  } catch {
    return Response.json(
      { status: "error", message: "Falha ao iniciar estudo do documento." },
      { status: 500 },
    );
  }
}
