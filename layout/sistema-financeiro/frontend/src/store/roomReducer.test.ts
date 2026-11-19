import { describe, expect, it } from 'vitest'
import type { RoomEvent } from '../ws/types'
import { isRoomEvent } from '../ws/types'
import { applyEvent, bubbleText, initialRoomState, loadHistory, MAX_LOG } from './roomReducer'

const ts = '2026-11-18T14:00:00-03:00'

describe('applyEvent', () => {
  it('cycle_started marca ciclo ativo', () => {
    const ev: RoomEvent = {
      type: 'cycle_started',
      ts,
      cycle_id: 'c1',
      payload: { ticker: 'PETR4.SA' },
    }
    const s = applyEvent(initialRoomState, ev)
    expect(s.activeCycle).toEqual({ id: 'c1', ticker: 'PETR4.SA' })
    expect(s.log).toHaveLength(1)
  })

  it('agent_status atualiza o status do agente', () => {
    const ev: RoomEvent = {
      type: 'agent_status',
      ts,
      cycle_id: 'c1',
      payload: { agent: 'news', status: 'thinking' },
    }
    expect(applyEvent(initialRoomState, ev).agents.news.status).toBe('thinking')
  })

  it('agent_message guarda o balão resumido e o texto completo no log', () => {
    const longo = 'a'.repeat(300)
    const ev: RoomEvent = {
      type: 'agent_message',
      ts,
      cycle_id: 'c1',
      payload: { agent: 'chart', text: longo },
    }
    const s = applyEvent(initialRoomState, ev)
    expect(s.agents.chart.bubble!.length).toBeLessThanOrEqual(140)
    expect(s.log[0]).toBe(ev)
  })

  it('cycle_finished encerra o ciclo e volta todos para idle', () => {
    let s = applyEvent(initialRoomState, {
      type: 'agent_status',
      ts,
      cycle_id: 'c1',
      payload: { agent: 'risk', status: 'done' },
    })
    s = applyEvent(s, {
      type: 'cycle_finished',
      ts,
      cycle_id: 'c1',
      payload: { duration_ms: 10, tokens: 0, cost: 0 },
    })
    expect(s.activeCycle).toBeNull()
    expect(s.agents.risk.status).toBe('idle')
    expect(s.lastCycleCost).toBe(0)
    expect(s.cyclesFinished).toBe(1)
  })

  it('decision é registrada como última decisão', () => {
    const s = applyEvent(initialRoomState, {
      type: 'decision',
      ts,
      cycle_id: 'c1',
      payload: { action: 'ESPERA', ticker: 'VALE3.SA', qty: 0, stop: null, rationale: 'x' },
    })
    expect(s.lastDecision?.action).toBe('ESPERA')
  })

  it('o log é limitado a MAX_LOG eventos (mais recentes primeiro)', () => {
    let s = initialRoomState
    for (let i = 0; i < MAX_LOG + 10; i++) {
      s = applyEvent(s, { type: 'risk_veto', ts, cycle_id: null, payload: { reason: `r${i}` } })
    }
    expect(s.log).toHaveLength(MAX_LOG)
    expect(s.log[0].payload).toEqual({ reason: `r${MAX_LOG + 9}` })
  })
})

describe('veto, carteira e histórico', () => {
  it('risk_veto liga a placa e cycle_started desliga', () => {
    let s = applyEvent(initialRoomState, {
      type: 'risk_veto',
      ts,
      cycle_id: 'c1',
      payload: { reason: 'perda diária' },
    })
    expect(s.veto).toBe('perda diária')
    s = applyEvent(s, { type: 'cycle_started', ts, cycle_id: 'c2', payload: { ticker: 'X' } })
    expect(s.veto).toBeNull()
  })

  it('portfolio_update guarda a carteira', () => {
    const s = applyEvent(initialRoomState, {
      type: 'portfolio_update',
      ts,
      cycle_id: 'c1',
      payload: { cash: 10, equity: 20, positions: [], initial_cash: 20 },
    })
    expect(s.portfolio?.equity).toBe(20)
  })

  it('loadHistory põe o histórico depois dos eventos ao vivo e sem duplicar', () => {
    const ao_vivo: RoomEvent = {
      type: 'risk_veto',
      ts: '2026-11-18T15:00:00-03:00',
      cycle_id: null,
      payload: { reason: 'novo' },
    }
    const antigo: RoomEvent = {
      type: 'decision',
      ts: '2026-11-18T10:00:00-03:00',
      cycle_id: 'c0',
      payload: { action: 'ESPERA', ticker: 'X', qty: 0, stop: null, rationale: '' },
    }
    let s = applyEvent(initialRoomState, ao_vivo)
    s = loadHistory(s, [antigo, ao_vivo])
    expect(s.log.map((e) => e.type)).toEqual(['risk_veto', 'decision'])
    expect(s.lastDecision?.action).toBe('ESPERA')
  })
})

describe('bubbleText', () => {
  it('mantém textos curtos', () => {
    expect(bubbleText('olá')).toBe('olá')
  })
  it('corta textos longos com reticências', () => {
    const r = bubbleText('x'.repeat(200))
    expect(r.length).toBe(140)
    expect(r.endsWith('…')).toBe(true)
  })
})

describe('isRoomEvent', () => {
  it('rejeita tipos desconhecidos', () => {
    expect(isRoomEvent({ type: 'hack', ts, payload: {} })).toBe(false)
    expect(isRoomEvent(null)).toBe(false)
  })
  it('aceita eventos do contrato', () => {
    expect(isRoomEvent({ type: 'risk_veto', ts, cycle_id: null, payload: { reason: 'x' } })).toBe(
      true,
    )
  })
})
