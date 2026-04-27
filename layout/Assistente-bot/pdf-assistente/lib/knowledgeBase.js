import fs from "fs";
import path from "path";
import { loadPDF } from "@/lib/pdfLoader";
import { chunkText } from "@/lib/textChunker";

/**
 * Caminhos principais usados para leitura do PDF e persistencia de cache.
 * @type {string}
 */
const DOCUMENT_PATH = path.join(process.cwd(), "data/documento.pdf");
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "documento-knowledge.json");

/** @type {string[] | null} */
let cachedChunks = null;
/** @type {Promise<string[]> | null} */
let studyPromise = null;
/** @type {"idle" | "processing" | "ready" | "error"} */
let studyStatus = "idle";
/** @type {string} */
let studyMessage = "Aguardando comando de estudo.";
/** @type {string | null} */
let lastStudiedAt = null;

/**
 * Gera uma assinatura do PDF para validar o cache.
 *
 * @returns {{ size: number, mtimeMs: number }} Metadados atuais do arquivo.
 */
function getDocumentSignature() {
  const stat = fs.statSync(DOCUMENT_PATH);
  return { size: stat.size, mtimeMs: stat.mtimeMs };
}

/**
 * Tenta carregar o cache em disco quando o PDF nao mudou.
 *
 * @returns {string[] | null} Chunks validos ou null quando invalido.
 */
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

/**
 * Persiste os chunks gerados para reaproveitamento em novas inicializacoes.
 *
 * @param {string[]} chunks Chunks derivados do texto do PDF.
 * @returns {void}
 */
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

/**
 * Retorna o status atual do processo de estudo do documento.
 *
 * @returns {{ status: "idle" | "processing" | "ready" | "error", message: string, lastStudiedAt: string | null }}
 */
export function getStudyStatus() {
  return {
    status: studyStatus,
    message: studyMessage,
    lastStudiedAt,
  };
}

/**
 * Retorna os chunks mantidos em memoria, quando disponiveis.
 *
 * @returns {string[] | null}
 */
export function getChunks() {
  return cachedChunks;
}

/**
 * Estuda o PDF para gerar base de consulta e atualiza cache/memoria.
 *
 * @param {{ force?: boolean }} [options] Opcoes de execucao.
 * @returns {Promise<string[]>} Chunks prontos para busca.
 */
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
