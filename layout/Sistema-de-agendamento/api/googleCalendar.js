import { google } from 'googleapis';
import { addMinutes } from 'date-fns';

// Carregue suas credenciais do Google (OAuth2)
// Para produção, use variáveis de ambiente (process.env)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

export async function listarEventos(data) {
  // data: string 'YYYY-MM-DD'
  const timeMin = new Date(`${data}T00:00:00-03:00`).toISOString();
  const timeMax = new Date(`${data}T23:59:59-03:00`).toISOString();
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items;
}

export async function criarEvento({ nome, email, data, horario }) {
  // data: 'YYYY-MM-DD', horario: 'HH:mm'
  const start = new Date(`${data}T${horario}:00-03:00`);
  const end = addMinutes(start, 40);
  const event = {
    summary: `${nome} - ${horario}`,
    description: `Agendamento para ${nome} (${email})`,
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    attendees: [{ email }],
  };
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
  });
  return res.data;
}

export async function deletarEvento(eventId) {
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });
} 