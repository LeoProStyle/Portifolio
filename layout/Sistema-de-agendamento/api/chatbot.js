import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = `Você é um assistente de agendamento para um salão de beleza. O cliente pode pedir para agendar, consultar ou cancelar um horário. Sempre extraia a intenção (agendar, consultar, cancelar) e os dados necessários (nome, data, horário, email, eventId se for cancelar). Responda sempre em português. Se faltar algum dado, peça de forma educada.

Sua resposta deve ser SEMPRE um JSON válido, no formato:
{
  "intencao": "agendar|consultar|cancelar|outro",
  "dados": { "nome": "", "email": "", "data": "", "horario": "", "eventId": "" },
  "resposta": "Mensagem para o cliente"
}
Se não souber algum dado, deixe vazio. Se a intenção for 'outro', apenas responda educadamente.
`;

/**
 * Interpreta a mensagem do usuário utilizando o modelo da OpenAI para identificar a intenção e extrair dados relevantes para agendamento em um salão de beleza.
 *
 * @param {string} mensagem - Mensagem enviada pelo usuário.
 * @param {Array<Object>} [contexto=[]] - Contexto de mensagens anteriores para manter a conversa (opcional).
 * @returns {Promise<Object>} Um objeto JSON com as chaves: intencao (string), dados (objeto com nome, email, data, horario, eventId) e resposta (string para o cliente).
 */
export async function interpretarMensagem(mensagem, contexto = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...contexto,
    { role: 'user', content: mensagem }
  ];
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.2,
    max_tokens: 400
  });
  // Tentar parsear o JSON da resposta
  try {
    const json = JSON.parse(completion.choices[0].message.content);
    return json;
  } catch (e) {
    return {
      intencao: 'outro',
      dados: {},
      resposta: 'Desculpe, não entendi sua solicitação. Poderia reformular?'
    };
  }
} 