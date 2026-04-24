import { getStudyStatus, studyDocument } from "@/lib/knowledgeBase";

export async function GET() {
  return Response.json(getStudyStatus());
}

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
