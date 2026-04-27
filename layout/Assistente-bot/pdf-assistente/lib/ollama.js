import axios from "axios";

/**
 * Envia um prompt ao Ollama e retorna o texto gerado pelo modelo.
 *
 * @param {string} prompt Contexto e pergunta montados pela API.
 * @returns {Promise<string>} Resposta textual retornada pelo modelo.
 */
export async function askOllama(prompt) {
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3",
    prompt,
    stream: false,
  });

  return response.data.response;
}