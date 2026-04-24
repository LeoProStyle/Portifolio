import fs from "fs";
import path from "path";
import { loadPDF } from "@/lib/pdfLoader";
import { chunkText } from "@/lib/textChunker";

const DOCUMENT_PATH = path.join(process.cwd(), "data/documento.pdf");
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "documento-knowledge.json");

let cachedChunks = null;
let studyPromise = null;
let studyStatus = "idle";
let studyMessage = "Aguardando comando de estudo.";
let lastStudiedAt = null;

function getDocumentSignature() {
  const stat = fs.statSync(DOCUMENT_PATH);
  return { size: stat.size, mtimeMs: stat.mtimeMs };
}

function readCacheIfValid() {
  if (!fs.existsSync(CACHE_PATH)) return null;

  const raw = fs.readFileSync(CACHE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const currentSignature = getDocumentSignature();

  if (
    parsed?.signature?.size === currentSignature.size &&
    parsed?.signature?.mtimeMs === currentSignature.mtimeMs &&
    Array.isArray(parsed?.chunks) &&
    parsed.chunks.length > 0
  ) {
    lastStudiedAt = parsed.lastStudiedAt || null;
    return parsed.chunks;
  }

  return null;
}

function writeCache(chunks) {
  const payload = {
    signature: getDocumentSignature(),
    lastStudiedAt: new Date().toISOString(),
    chunks,
  };

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), "utf8");
  lastStudiedAt = payload.lastStudiedAt;
}

export function getStudyStatus() {
  return {
    status: studyStatus,
    message: studyMessage,
    lastStudiedAt,
  };
}

export function getChunks() {
  return cachedChunks;
}

export async function studyDocument({ force = false } = {}) {
  if (studyPromise) return studyPromise;
  if (!force && cachedChunks?.length) return cachedChunks;

  studyStatus = "processing";
  studyMessage = "Atualizando...";

  studyPromise = (async () => {
    try {
      if (!force) {
        const cached = readCacheIfValid();
        if (cached) {
          cachedChunks = cached;
          studyStatus = "ready";
          studyMessage = "Documento estudado e pronto para consulta.";
          return cachedChunks;
        }
      }

      const text = await loadPDF(DOCUMENT_PATH);
      cachedChunks = chunkText(text);
      writeCache(cachedChunks);

      studyStatus = "ready";
      studyMessage = "Documento estudado e pronto para consulta.";
      return cachedChunks;
    } catch (error) {
      studyStatus = "error";
      studyMessage = "Falha ao estudar documento.";
      throw error;
    } finally {
      studyPromise = null;
    }
  })();

  return studyPromise;
}

// Inicia o estudo automático ao subir o servidor.
void studyDocument().catch(() => {});
