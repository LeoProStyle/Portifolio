import { describe, expect, it } from 'vitest'
import { toChartTime } from './chartTime'

describe('toChartTime', () => {
  it('candle diário vira data de negócio YYYY-MM-DD (sem trocar de dia pelo fuso)', () => {
    expect(toChartTime('2026-11-17T00:00:00-03:00', '1d')).toBe('2026-11-17')
  })

  it('candle horário vira timestamp deslocado para exibir o horário de Brasília', () => {
    // 10:00 em Brasília = 13:00 UTC; o gráfico mostra UTC, então deslocamos -3h
    const t = toChartTime('2026-11-17T10:00:00-03:00', '1h') as number
    expect(new Date(t * 1000).toISOString()).toBe('2026-11-17T10:00:00.000Z')
  })
})
