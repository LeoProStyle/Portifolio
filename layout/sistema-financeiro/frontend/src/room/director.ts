/**
 * Traduz eventos do WebSocket em ações da sala (função pura).
 * A animação é teatro: tudo que ela mostra também está na linha do tempo.
 */
import { bubbleText } from '../store/roomReducer'
import type { Action, AgentName, RoomEvent, Side } from '../ws/types'

/** Bonecos presentes na sala (Otimista/Pessimista entram na Fase 5). */
export const ROOM_AGENTS = ['news', 'chart', 'risk', 'manager'] as const
export type RoomAgent = (typeof ROOM_AGENTS)[number]

export type RoomAction =
  | { kind: 'lights'; on: boolean }
  | { kind: 'work'; agent: RoomAgent }
  | { kind: 'finish'; agent: RoomAgent }
  | { kind: 'alert'; agent: RoomAgent }
  | { kind: 'say'; agent: RoomAgent; text: string }
  | { kind: 'veto'; reason: string }
  | { kind: 'toTerminal'; action: Action }
  | { kind: 'terminalFlash'; side: Side }
  | { kind: 'allIdle' }

function inRoom(agent: AgentName): agent is RoomAgent {
  return (ROOM_AGENTS as readonly string[]).includes(agent)
}

export function directorActions(ev: RoomEvent): RoomAction[] {
  switch (ev.type) {
    case 'cycle_started':
      return [{ kind: 'lights', on: true }]
    case 'agent_status': {
      const { agent, status } = ev.payload
      if (!inRoom(agent)) return []
      if (status === 'thinking') return [{ kind: 'work', agent }]
      if (status === 'done') return [{ kind: 'finish', agent }]
      if (status === 'error')
        return [
          { kind: 'finish', agent },
          { kind: 'alert', agent },
        ]
      return []
    }
    case 'agent_message': {
      const { agent, text } = ev.payload
      return inRoom(agent) ? [{ kind: 'say', agent, text: bubbleText(text) }] : []
    }
    case 'risk_veto':
      return [{ kind: 'veto', reason: ev.payload.reason }]
    case 'decision':
      return [{ kind: 'toTerminal', action: ev.payload.action }]
    case 'order_filled':
      return [{ kind: 'terminalFlash', side: ev.payload.side }]
    case 'cycle_finished':
      return [{ kind: 'lights', on: false }, { kind: 'allIdle' }]
    default:
      return []
  }
}
