import express from 'express';
import agendamentoRouter from './agendamento.js';
import webhookRouter from './webhook.js';

const app = express();
app.use(express.json());

app.use('/agendamento', agendamentoRouter);
app.use('/webhook', webhookRouter);

app.get('/', (req, res) => {
  res.json({ status: 'API de Agendamento rodando!' });
});

export default app;

// Para rodar localmente
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
} 