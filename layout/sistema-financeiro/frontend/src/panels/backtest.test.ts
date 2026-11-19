import { describe, expect, it } from 'vitest'
import { benchmarkLabel, checkLabel, curveTime, fmtPct, periodRange } from './backtest'

describe('periodRange', () => {
  it('volta N anos a partir de hoje (data local)', () => {
    expect(periodRange(2, new Date(2026, 10, 19))).toEqual({
      start: '2024-11-19',
      end: '2026-11-19',
    })
  })
})

describe('checkLabel', () => {
  it('diferencia passou, não passou e sem dados', () => {
    expect(checkLabel(true)).toBe('passou')
    expect(checkLabel(false)).toBe('não passou')
    expect(checkLabel(null)).toBe('sem dados')
  })
})

describe('curveTime', () => {
  it('diário vira a data de Brasília; horário desloca o fuso', () => {
    // 18/11/2026 18:00 em Brasília = 21:00 UTC
    const ts = Date.UTC(2026, 10, 18, 21, 0) / 1000
    expect(curveTime(ts, '1d')).toBe('2026-11-18')
    expect(curveTime(ts, '1h')).toBe(ts - 3 * 3600)
  })
})

describe('fmtPct', () => {
  it('formata com sinal e vírgula; nulo vira traço', () => {
    expect(fmtPct(0.1234)).toBe('+12,34%')
    expect(fmtPct(-0.05)).toBe('-5,00%')
    expect(fmtPct(null)).toBe('—')
  })
})

describe('benchmarkLabel', () => {
  it('nomeia o benchmark de cada sala', () => {
    expect(benchmarkLabel('^BVSP')).toBe('Ibovespa')
    expect(benchmarkLabel('1 contrato de WIN')).toBe('1 contrato de WIN')
    expect(benchmarkLabel('BTC-USD')).toBe('Bitcoin (BTC-USD)')
  })
})
