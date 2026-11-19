import type { AgentName, AgentStatus, PayloadMap, PortfolioPayload, RoomEvent } from '../ws/types'

export const MAX_LOG = 500
export const BUBBLE_MAX = 140

export interface AgentState {
  status: AgentStatus
  bubble: string | null
}

export interface RoomState {
  agents: Record<AgentName, AgentState>
  activeCycle: { id: string | null; ticker: string } | null
  lastDecision: PayloadMap['decision'] | null
  lastCycleCost: number | null
  /** Motivo do veto do Risco no ciclo atual (placa "PARE"). */
  veto: string | null
  /** Última carteira recebida por portfolio_update. */
  portfolio: PortfolioPayload | null
  /** Incrementa a cada ciclo encerrado: os painéis de dados recarregam com ele. */
  cyclesFinished: number
  /** Linha do tempo, mais recente primeiro. É a fonte de verdade, não a animação. */
  log: RoomEvent[]
}

const idle: AgentState = { status: 'idle', bubble: null }

export const initialRoomState: RoomState = {
  agents: { news: idle, chart: idle, bull: idle, bear: idle, risk: idle, manager: idle },
  activeCycle: null,
  lastDecision: null,
  lastCycleCost: null,
  veto: null,
  portfolio: null,
  cyclesFinished: 0,
  log: [],
}

/** Resume o texto para o balão de fala; o texto completo fica no log. */
export function bubbleText(text: string, max = BUBBLE_MAX): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

function setAgent(state: RoomState, agent: AgentName, patch: Partial<AgentState>): RoomState {
  return { ...state, agents: { ...state.agents, [agent]: { ...state.agents[agent], ...patch } } }
}

/** Função pura: aplica um evento WS ao estado da sala. */
export function applyEvent(prev: RoomState, ev: RoomEvent): RoomState {
  const state: RoomState = { ...prev, log: [ev, ...prev.log].slice(0, MAX_LOG) }

  switch (ev.type) {
    case 'cycle_started':
      return { ...state, activeCycle: { id: ev.cycle_id, ticker: ev.payload.ticker }, veto: null }
    case 'agent_status':
      return setAgent(state, ev.payload.agent, { status: ev.payload.status })
    case 'agent_message':
      return setAgent(state, ev.payload.agent, { bubble: bubbleText(ev.payload.text) })
    case 'risk_veto':
      return { ...state, veto: ev.payload.reason }
    case 'decision':
      return { ...state, lastDecision: ev.payload }
    case 'portfolio_update':
      return { ...state, portfolio: ev.payload }
    case 'cycle_finished': {
      const agents = Object.fromEntries(
        Object.keys(state.agents).map((name) => [name, idle]),
      ) as RoomState['agents']
      return {
        ...state,
        agents,
        activeCycle: null,
        lastCycleCost: ev.payload.cost,
        cyclesFinished: state.cyclesFinished + 1,
      }
    }
    default:
      return state
  }
}

/**
 * Carrega o histórico gravado no backend (mais antigo → mais recente) na
 * linha do tempo, sem reanimar os bonecos.
 */
export function loadHistory(prev: RoomState, events: RoomEvent[]): RoomState {
  const known = new Set(prev.log.map((e) => `${e.ts}|${e.type}`))
  const older = events.filter((e) => !known.has(`${e.ts}|${e.type}`))
  const log = [...prev.log, ...older.reverse()].slice(0, MAX_LOG)
  const lastDecision = prev.lastDecision ?? findLast(events, 'decision')
  const portfolio = prev.portfolio ?? findLast(events, 'portfolio_update')
  return { ...prev, log, lastDecision, portfolio }
}

function findLast<K extends RoomEvent['type']>(events: RoomEvent[], type: K): PayloadMap[K] | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.type === type) return e.payload as PayloadMap[K]
  }
  return null
}
