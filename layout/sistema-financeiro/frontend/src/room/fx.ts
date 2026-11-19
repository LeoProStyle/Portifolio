/**
 * Estado dos efeitos da sala 3D + cérebros dos bonecos.
 * Recebe as ações do director (puras) e não depende de Three.js: testável.
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Side } from '../ws/types'
import { CharacterBrain } from './brain'
import { ROOM_AGENTS, type RoomAction, type RoomAgent } from './director'
import { AGENT_DESKS, seatOf, TERMINAL_SPOT, WALK_SPEED } from './layout3d'

export const BUBBLE_MS = 5000
export const ALERT_MS = 3000
export const FLASH_MS = 1000
export const TERMINAL_PAUSE_MS = 1400

export interface Bubble {
  text: string
  until: number
}

export interface FxState {
  lights: boolean
  /** Motivo do veto (placa PARE levantada) ou null. */
  veto: string | null
  bubbles: Partial<Record<RoomAgent, Bubble>>
  alerts: Partial<Record<RoomAgent, number>>
  flash: { side: Side; until: number } | null
}

export interface RoomFx {
  store: StoreApi<FxState>
  brains: Record<RoomAgent, CharacterBrain>
  apply: (action: RoomAction) => void
  now: () => number
}

export function createRoomFx(opts: { reducedMotion: boolean; now?: () => number }): RoomFx {
  const now = opts.now ?? (() => performance.now())
  const speed = opts.reducedMotion ? Infinity : WALK_SPEED
  const brains = Object.fromEntries(
    ROOM_AGENTS.map((a) => [a, new CharacterBrain(seatOf(AGENT_DESKS[a]), speed)]),
  ) as Record<RoomAgent, CharacterBrain>

  const store = createStore<FxState>()(() => ({
    lights: false,
    veto: null,
    bubbles: {},
    alerts: {},
    flash: null,
  }))

  function apply(action: RoomAction): void {
    const set = store.setState
    switch (action.kind) {
      case 'lights':
        set(action.on ? { lights: true, veto: null } : { lights: false })
        break
      case 'work':
        brains[action.agent].work()
        break
      case 'finish':
        brains[action.agent].finish()
        break
      case 'alert':
        set((s) => ({ alerts: { ...s.alerts, [action.agent]: now() + ALERT_MS } }))
        break
      case 'say':
        set((s) => ({
          bubbles: {
            ...s.bubbles,
            [action.agent]: { text: action.text, until: now() + BUBBLE_MS },
          },
        }))
        break
      case 'veto':
        set({ veto: action.reason })
        break
      case 'toTerminal':
        brains.manager.visit(TERMINAL_SPOT, TERMINAL_PAUSE_MS)
        break
      case 'terminalFlash':
        set({ flash: { side: action.side, until: now() + FLASH_MS } })
        break
      case 'allIdle':
        for (const a of ROOM_AGENTS) brains[a].rest()
        break
    }
  }

  return { store, brains, apply, now }
}
