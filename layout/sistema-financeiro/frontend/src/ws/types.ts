// Espelho de backend/app/events.py — manter os dois sincronizados.

export type AgentName = 'news' | 'chart' | 'bull' | 'bear' | 'risk' | 'manager'
export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error'
export type Action = 'COMPRA' | 'VENDA' | 'ESPERA'
export type Side = 'COMPRA' | 'VENDA'

export interface Position {
  ticker: string
  qty: number
  avg_price: number
  stop?: number | null
  mark?: number | null
  pnl?: number | null
}

export interface PortfolioPayload {
  cash: number
  positions: Position[]
  equity: number
  initial_cash?: number | null
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PayloadMap {
  cycle_started: { ticker: string }
  agent_status: { agent: AgentName; status: AgentStatus }
  agent_message: { agent: AgentName; text: string }
  agent_result: { agent: AgentName; result: Record<string, unknown> }
  decision: { action: Action; ticker: string; qty: number; stop: number | null; rationale: string }
  order_filled: {
    ticker: string
    side: Side
    qty: number
    price: number
    fee: number
    reason: 'decisao' | 'stop' | 'alvo'
    time: string
  }
  portfolio_update: PortfolioPayload
  price_update: { ticker: string; candle: Candle }
  risk_veto: { reason: string }
  budget_warning: { spent: number; limit: number }
  cycle_finished: { duration_ms: number; tokens: number; cost: number }
}

export type EventType = keyof PayloadMap

/** Envelope comum; `type` discrimina o payload. */
export type RoomEvent = {
  [K in EventType]: {
    type: K
    ts: string
    cycle_id: string | null
    // escritório: sala e robô que geraram o evento (ausentes no ciclo da Mesa IA)
    room?: string | null
    robot_id?: string | null
    payload: PayloadMap[K]
  }
}[EventType]

export const EVENT_TYPES: readonly EventType[] = [
  'cycle_started',
  'agent_status',
  'agent_message',
  'agent_result',
  'decision',
  'order_filled',
  'portfolio_update',
  'price_update',
  'risk_veto',
  'budget_warning',
  'cycle_finished',
]

/** Checagem mínima do envelope (a validação completa é feita no backend). */
/** Evento de um robô do escritório (tem `robot_id`); os da equipe de IA não têm. */
export function isRobotEvent(ev: RoomEvent): boolean {
  return typeof ev.robot_id === 'string' && ev.robot_id.length > 0
}

export function isRoomEvent(value: unknown): value is RoomEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    (EVENT_TYPES as readonly string[]).includes(v.type) &&
    typeof v.ts === 'string' &&
    typeof v.payload === 'object' &&
    v.payload !== null
  )
}
