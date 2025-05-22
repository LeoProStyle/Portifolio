import { Router } from 'express';
import { interpretarMensagem } from './chatbot.js';
import axios from 'axios';
import { criarEvento, listarEventos, deletarEvento } from './googleCalendar.js';

const router = Router();

// Função para enviar mensagem de volta via Z-API
async function enviarWhatsapp(phone, message) {
  const url = 'https://api.z-api.io/instances/SEU_INSTANCE_ID/token/SEU_TOKEN/send-text';
  await axios.post(url, {
    phone,
    message
  });
}

router.post('/', async (req, res) => {
  try {
    const { body } = req;
    const mensagem = body.text || body.message || '';
    const telefone = body.phone || body.sender || '';
    if (!mensagem || !telefone) {
      return res.status(400).json({ erro: 'Mensagem ou telefone ausente' });
    }
    // Interpretar intenção com o chatbot
    const resultado = await interpretarMensagem(mensagem);
    let respostaFinal = resultado.resposta;
    // Executar ação conforme intenção
    if (resultado.intencao === 'agendar') {
      const { nome, email, data, horario } = resultado.dados;
      if (nome && email && data && horario) {
        try {
          await criarEvento({ nome, email, data, horario });
          respostaFinal = `Agendamento realizado com sucesso para ${nome} em ${data} às ${horario}!`;
        } catch (e) {
          respostaFinal = 'Não foi possível realizar o agendamento. Tente novamente mais tarde.';
        }
      }
    } else if (resultado.intencao === 'consultar') {
      const { data } = resultado.dados;
      if (data) {
        try {
          const eventos = await listarEventos(data);
          if (eventos.length === 0) {
            respostaFinal = 'Não há agendamentos para esta data.';
          } else {
            respostaFinal = 'Agendamentos para esta data:\n' + eventos.map(ev => {
              const dt = new Date(ev.start.dateTime || ev.start.date);
              return `- ${ev.summary} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }).join('\n');
          }
        } catch (e) {
          respostaFinal = 'Não foi possível consultar os agendamentos.';
        }
      }
    } else if (resultado.intencao === 'cancelar') {
      const { eventId } = resultado.dados;
      if (eventId) {
        try {
          await deletarEvento(eventId);
          respostaFinal = 'Agendamento cancelado com sucesso!';
        } catch (e) {
          respostaFinal = 'Não foi possível cancelar o agendamento.';
        }
      } else {
        respostaFinal = 'Por favor, informe o código do agendamento (eventId) que deseja cancelar.';
      }
    }
    // Enviar resposta para o WhatsApp
    await enviarWhatsapp(telefone, respostaFinal);
    res.status(200).json({ status: 'Respondido', resposta: respostaFinal });
  } catch (e) {
    console.error('Erro no webhook:', e);
    res.status(500).json({ erro: 'Erro ao processar webhook', detalhes: e.message });
  }
});

export default router; 