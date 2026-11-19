import type { AgentName, AgentStatus, RoomEvent } from '../ws/types'

export const AGENT_LABEL: Record<AgentName, string> = {
  news: 'Notícias',
  chart: 'Gráfico',
  bull: 'Otimista',
  bear: 'Pessimista',
  risk: 'Risco',
  manager: 'Gestor',
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'parado',
  thinking: 'pensando…',
  done: 'concluído',
  error: 'erro',
}

/** Agentes exibidos na Fase 1 (debate entra na Fase 5). */
export const ACTIVE_AGENTS: AgentName[] = ['news', 'chart', 'risk', 'manager']

export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function num(v: unknown, digits = 2): string {
  return typeof v === 'number' ? v.toFixed(digits) : '—'
}

/** Resumo legível do JSON de cada agente (o JSON completo fica no detalhe). */
export function summarizeResult(r: Record<string, unknown>): string {
  if ('sentiment' in r) return `sentimento ${num(r.sentiment)} · confiança ${num(r.confidence)}`
  if ('trend' in r)
    return `tendência ${String(r.trend)} · sinal ${num(r.signal)} — ${String(r.reasoning ?? '')}`
  if ('approved' in r) {
    return `${r.approved ? 'aprovado' : 'reprovado'} · máx. ${String(r.max_qty)} · stop ${num(r.stop)} — ${String(r.notes ?? '')}`
  }
  if ('qty' in r) return `${String(r.action)} ${String(r.qty)} — ${String(r.rationale ?? '')}`
  if ('action' in r) return `proposta ${String(r.action)} — ${String(r.rationale ?? '')}`
  return JSON.stringify(r)
}

/** Resumo em texto de cada evento — tudo que a animação mostra aparece aqui. */
export function describeEvent(ev: RoomEvent): string {
  switch (ev.type) {
    case 'cycle_started':
      return `Ciclo iniciado para ${ev.payload.ticker}`
    case 'agent_status':
      return `${AGENT_LABEL[ev.payload.agent]}: ${STATUS_LABEL[ev.payload.status]}`
    case 'agent_message':
      return `${AGENT_LABEL[ev.payload.agent]} diz: ${ev.payload.text}`
    case 'agent_result':
      return `${AGENT_LABEL[ev.payload.agent]} entregou: ${summarizeResult(ev.payload.result)}`
    case 'decision': {
      const p = ev.payload
      const stop = p.stop ? ` · stop R$ ${p.stop.toFixed(2)}` : ''
      return `Decisão: ${p.action} ${p.ticker} (qtd ${p.qty}${stop}) — ${p.rationale}`
    }
    case 'order_filled': {
      const p = ev.payload
      const motivo = p.reason === 'stop' ? ' (stop atingido)' : ''
      return `Ordem simulada executada${motivo}: ${p.side} ${p.qty} ${p.ticker} @ R$ ${p.price.toFixed(2)} · taxa R$ ${p.fee.toFixed(2)}`
    }
    case 'portfolio_update':
      return `Patrimônio simulado: R$ ${ev.payload.equity.toFixed(2)}`
    case 'price_update':
      return `Novo candle de ${ev.payload.ticker}: fechamento R$ ${ev.payload.candle.close.toFixed(2)}`
    case 'risk_veto':
      return `Risco vetou: ${ev.payload.reason}`
    case 'budget_warning':
      return `Aviso de custo: US$ ${ev.payload.spent.toFixed(2)} de US$ ${ev.payload.limit.toFixed(2)}`
    case 'cycle_finished':
      return `Ciclo encerrado em ${(ev.payload.duration_ms / 1000).toFixed(1)}s · ${ev.payload.tokens} tokens · US$ ${ev.payload.cost.toFixed(4)}`
  }
}
