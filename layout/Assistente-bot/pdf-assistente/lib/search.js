/**
 * Calcula uma similaridade simples entre duas strings com base
 * na quantidade de palavras em comum.
 *
 * @param {string} a Texto de referência.
 * @param {string} b Texto comparado.
 * @returns {number} Quantidade de termos compartilhados.
 */
function similarity(a, b) {
  const aWords = a.toLowerCase().split(/\W+/);
  const bWords = b.toLowerCase().split(/\W+/);

  const common = aWords.filter((word) => bWords.includes(word));
  return common.length;
}

/**
 * Ordena os blocos do documento por relevância e devolve os 3 melhores.
 *
 * @param {string} query Pergunta do usuario.
 * @param {string[]} chunks Blocos de texto previamente indexados.
 * @returns {{ chunk: string, score: number }[]} Lista ranqueada de resultados.
 */
export function search(query, chunks) {
  const scored = chunks.map((chunk) => ({
    chunk,
    score: similarity(query, chunk),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3);
}