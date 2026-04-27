/**
 * Divide um texto grande em partes menores para busca semantica.
 *
 * @param {string} text Conteudo completo do documento.
 * @param {number} [size=500] Tamanho maximo (em caracteres) de cada bloco.
 * @returns {string[]} Lista de blocos gerados na ordem original.
 */
export function chunkText(text, size = 500) {
  const chunks = [];

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
}