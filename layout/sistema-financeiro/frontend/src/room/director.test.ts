import { describe, expect, it } from 'vitest'
import type { RoomEvent } from '../ws/types'
import { directorActions } from './director'

const ts = '2026-11-18T14:00:00-03:00'

function ev<E extends RoomEvent>(e: Omit<E, 'ts' | 'cycle_id'>): RoomEvent {
  return { ts, cycle_id: 'c1', ...e } as RoomEvent
}

describe('directorActions', () => {
  it('cycle_started acende a luz', () => {
    expect(directorActions(ev({ type: 'cycle_started', payload: { ticker: 'X' } }))).toEqual([
      { kind: 'lights', on: true },
    ])
  })

  it('thinking faz o boneco trabalhar; done faz falar e voltar', () => {
    expect(
      directorActions(ev({ type: 'agent_status', payload: { agent: 'news', status: 'thinking' } })),
    ).toEqual([{ kind: 'work', agent: 'news' }])
    expect(
      directorActions(ev({ type: 'agent_status', payload: { agent: 'chart', status: 'done' } })),
    ).toEqual([{ kind: 'finish', agent: 'chart' }])
  })

  it('erro mostra alerta', () => {
    expect(
      directorActions(ev({ type: 'agent_status', payload: { agent: 'risk', status: 'error' } })),
    ).toEqual([
      { kind: 'finish', agent: 'risk' },
      { kind: 'alert', agent: 'risk' },
    ])
  })

  it('mensagem vira balão resumido', () => {
    const [a] = directorActions(
      ev({ type: 'agent_message', payload: { agent: 'manager', text: 'x'.repeat(300) } }),
    )
    expect(a.kind).toBe('say')
    if (a.kind === 'say') expect(a.text.length).toBeLessThanOrEqual(140)
  })

  it('decisão leva o Gestor ao terminal', () => {
    expect(
      directorActions(
        ev({
          type: 'decision',
          payload: { action: 'COMPRA', ticker: 'X', qty: 10, stop: 1, rationale: '' },
        }),
      ),
    ).toEqual([{ kind: 'toTerminal', action: 'COMPRA' }])
  })

  it('veto levanta a placa; fim do ciclo apaga a luz e acalma todos', () => {
    expect(directorActions(ev({ type: 'risk_veto', payload: { reason: 'r' } }))).toEqual([
      { kind: 'veto', reason: 'r' },
    ])
    expect(
      directorActions(
        ev({ type: 'cycle_finished', payload: { duration_ms: 1, tokens: 0, cost: 0 } }),
      ),
    ).toEqual([{ kind: 'lights', on: false }, { kind: 'allIdle' }])
  })

  it('ordem executada pisca o terminal', () => {
    const acts = directorActions(
      ev({
        type: 'order_filled',
        payload: {
          ticker: 'X',
          side: 'VENDA',
          qty: 1,
          price: 1,
          fee: 0,
          reason: 'stop',
          time: ts,
        },
      }),
    )
    expect(acts).toEqual([{ kind: 'terminalFlash', side: 'VENDA' }])
  })

  it('agentes fora da sala (debate, Fase 5) são ignorados', () => {
    expect(
      directorActions(ev({ type: 'agent_status', payload: { agent: 'bull', status: 'thinking' } })),
    ).toEqual([])
  })
})
