import { describe, expect, it } from 'vitest'
import { describeEvent, summarizeResult } from './labels'

describe('summarizeResult', () => {
  it('resume cada tipo de agente', () => {
    expect(summarizeResult({ sentiment: 0.3, confidence: 0.5 })).toContain('sentimento 0.30')
    expect(summarizeResult({ trend: 'alta', signal: 0.5, reasoning: 'MM20 > MM50' })).toContain(
      'tendência alta',
    )
    expect(summarizeResult({ approved: false, max_qty: 0, stop: null, notes: 'veto' })).toContain(
      'reprovado',
    )
    expect(summarizeResult({ action: 'COMPRA', qty: 10, rationale: 'ok' })).toBe('COMPRA 10 — ok')
    expect(summarizeResult({ action: 'ESPERA', rationale: 'calma' })).toBe(
      'proposta ESPERA — calma',
    )
  })
})

describe('describeEvent', () => {
  it('ordem executada por stop aparece em texto', () => {
    const texto = describeEvent({
      type: 'order_filled',
      ts: '2026-11-19T10:00:00-03:00',
      cycle_id: null,
      payload: {
        ticker: 'PETR4.SA',
        side: 'VENDA',
        qty: 10,
        price: 95,
        fee: 0.3,
        reason: 'stop',
        time: '2026-11-19T00:00:00-03:00',
      },
    })
    expect(texto).toContain('stop atingido')
    expect(texto).toContain('PETR4.SA')
  })
})
