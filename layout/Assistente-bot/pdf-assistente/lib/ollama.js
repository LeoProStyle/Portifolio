import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "phi3";

/**
 * Envia um prompt ao Ollama e retorna o texto gerado pelo modelo.
 *
 * @param {string} prompt Contexto e pergunta montados pela API.
 * @returns {Promise<string>} Resposta textual retornada pelo modelo.
 */
export async function askOllama(prompt, model = DEFAULT_MODEL) {
  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model,
        prompt,
        stream: false,
      },
      { timeout: 30000 }
    );

    if (!response?.data?.response) {
      throw new Error("Ollama retornou uma resposta vazia.");
    }

    return response.data.response;
  } catch (error) {
    const detail = axios.isAxiosError(error)
      ? error.response?.data?.error || error.message
      : error instanceof Error
        ? error.message
        : "Erro desconhecido ao consultar o modelo.";

    throw new Error(`Não foi possível acessar o Ollama em ${OLLAMA_URL}: ${detail}`);
  }
}