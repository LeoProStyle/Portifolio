import { Router } from 'express';
import { format, isBefore, parse } from 'date-fns';
import { listarEventos, criarEvento, deletarEvento } from './googleCalendar.js';

const router = Router();

// Horários fixos do salão
const horariosFixos = [
  '08:00', '08:40', '09:20', '10:00', '10:40', '11:20', '12:00', '12:40',
  '13:20', '14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20'
];

// Função para calcular horários disponíveis
async function horariosDisponiveis(data, agora = new Date()) {
  const dataFormatada = format(data, 'yyyy-MM-dd');
  const eventos = await listarEventos(dataFormatada);
  const ocupados = eventos.map(ev => {
    const dt = new Date(ev.start.dateTime || ev.start.date);
    return format(dt, 'HH:mm');
  });
  return horariosFixos.filter(horario => {
    const horarioDate = parse(`${dataFormatada} ${horario}`, 'yyyy-MM-dd HH:mm', new Date());
    return !ocupados.includes(horario) && isBefore(agora, horarioDate);
  });
}

// Endpoint para consultar horários disponíveis
router.get('/disponiveis', async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ erro: 'Data obrigatória (yyyy-MM-dd)' });
    const agora = new Date();
    const disponiveis = await horariosDisponiveis(new Date(data), agora);
    res.json({ data, horarios: disponiveis });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao consultar horários', detalhes: e.message });
  }
});

// Endpoint para criar agendamento
router.post('/', async (req, res) => {
  try {
    const { nome, email, data, horario } = req.body;
    if (!nome || !email || !data || !horario) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, data, horario' });
    }
    const disponiveis = await horariosDisponiveis(new Date(data));
    if (!disponiveis.includes(horario)) {
      return res.status(400).json({ erro: 'Horário não disponível' });
    }
    const evento = await criarEvento({ nome, email, data, horario });
    res.status(201).json({ mensagem: 'Agendamento criado com sucesso!', evento });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao criar agendamento', detalhes: e.message });
  }
});

// Endpoint para consultar agendamentos
router.get('/', async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ erro: 'Data obrigatória (yyyy-MM-dd)' });
    const eventos = await listarEventos(data);
    res.json(eventos);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao consultar agendamentos', detalhes: e.message });
  }
});

// Endpoint para deletar agendamento
router.delete('/', async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ erro: 'eventId obrigatório' });
    await deletarEvento(eventId);
    res.json({ mensagem: 'Agendamento cancelado com sucesso!' });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao cancelar agendamento', detalhes: e.message });
  }
});

// Endpoint para atualizar agendamento
router.put('/', async (req, res) => {
  try {
    const { eventId, nome, email, data, novoHorario } = req.body;
    if (!eventId || !nome || !email || !data || !novoHorario) {
      return res.status(400).json({ erro: 'Campos obrigatórios: eventId, nome, email, data, novoHorario' });
    }
    await deletarEvento(eventId);
    const evento = await criarEvento({ nome, email, data, horario: novoHorario });
    res.json({ mensagem: 'Agendamento atualizado com sucesso!', evento });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao atualizar agendamento', detalhes: e.message });
  }
});

export default router; 