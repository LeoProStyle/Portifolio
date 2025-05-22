# Sistema de Agendamento (Node.js + Express)

Este projeto foi gerado a partir de um fluxo n8n para ser hospedado na Vercel, com endpoints prontos para integração com Google Calendar, OpenAI, etc.

## Como rodar localmente

```bash
cd layout/Sistema-de-agendamento
npm install
npm start
```

Acesse: http://localhost:3000/api/

## Endpoints principais

- `GET /api/agendamento/disponiveis?data=YYYY-MM-DD` — Horários disponíveis para agendamento
- `POST /api/agendamento` — Criar agendamento
  - Body: `{ nome, email, data, horario }`
- `GET /api/agendamento` — Listar agendamentos
- `DELETE /api/agendamento` — Cancelar agendamento
  - Body: `{ email, data, horario }`
- `PUT /api/agendamento` — Atualizar agendamento
  - Body: `{ email, data, horario, novoHorario }`
- `POST /api/webhook` — Receber webhooks externos

## Deploy na Vercel

1. Faça login na Vercel e importe este projeto.
2. Certifique-se que a pasta `api/` está na raiz do projeto.
3. O arquivo `vercel.json` já está configurado.

## Observações
- Os agendamentos estão em memória (mock). Para produção, integre com Google Calendar.
- Os horários seguem as regras do salão, conforme especificado no fluxo n8n.
- Pontos de integração estão comentados no código. 