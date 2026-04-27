import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

/**
 * Carrega e extrai o texto bruto de um arquivo PDF local.
 *
 * @param {string} path Caminho absoluto do arquivo PDF.
 * @returns {Promise<string>} Texto extraido do documento.
 */
export async function loadPDF(path) {
  const buffer = fs.readFileSync(path);
  const data = await pdf(buffer);
  return data.text;
}