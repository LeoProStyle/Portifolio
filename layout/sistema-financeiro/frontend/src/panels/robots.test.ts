import { describe, expect, it } from 'vitest'
import { isRobotEvent, type RoomEvent } from '../ws/types'
import {
  assetLabel,
  detailFor,
  liveDays,
  liveLabel,
  robotStatus,
  sortRobots,
  type RobotRow,
} from './robots'

function row(id: string, pnl: number, day_pnl = 0): RobotRow {
  return {
    id,
    name: id.toUpperCase(),
    room: 'acoes',
    strategy: 'sma_cross',
    ticker: 'PETR4.SA',
    interval: '1d',
    run_id: `${id}-x`,
    initial_cash: 100_000,
    equity: 100_000 + pnl,
    pnl,
    pnl_pct: pnl / 100_000,
    realized_pnl: pnl,
    unrealized_pnl: 0,
    spark: [],
    look: {},
    instrument: null,
    currency: 'BRL',
    universe: [],
    positions: [],
    live: {
      since: '2026-11-18T18:05:00-03:00',
      days: 0,
      target_days: 90,
      remaining_days: 90,
      robot_return: 0,
      hold_return: null,
      beats_hold: null,
    },
    day_pnl,
    day_pnl_pct: day_pnl / 100_000,
    open_qty: 0,
    last_signal: null,
    last_reason: null,
    last_decision_ts: null,
    enabled: true,
    paused: false,
  }
}

describe('sortRobots', () => {
  const rows = [row('vega', -50, 10), row('atlas', 300, -5), row('orion', 120, 40)]

  it('ordena por P&L total, do maior para o menor', () => {
    expect(sortRobots(rows, 'pnl').map((r) => r.id)).toEqual(['atlas', 'orion', 'vega'])
  })

  it('ordena por P&L do dia', () => {
    expect(sortRobots(rows, 'day_pnl').map((r) => r.id)).toEqual(['orion', 'vega', 'atlas'])
  })

  it('ordena por nome e não altera a lista original', () => {
    expect(sortRobots(rows, 'name').map((r) => r.id)).toEqual(['atlas', 'orion', 'vega'])
    expect(rows.map((r) => r.id)).toEqual(['vega', 'atlas', 'orion'])
  })
})

describe('isRobotEvent', () => {
  const base = { type: 'decision', ts: '2026-11-18T18:00:00-03:00', cycle_id: null } as const
  const payload = {
    action: 'ESPERA',
    ticker: 'PETR4.SA',
    qty: 0,
    stop: null,
    rationale: 'x',
  } as const

  it('evento de robô do escritório tem robot_id', () => {
    const ev: RoomEvent = { ...base, robot_id: 'atlas', room: 'acoes', payload }
    expect(isRobotEvent(ev)).toBe(true)
  })

  it('evento da equipe de IA (sem robot_id) não é de robô', () => {
    expect(isRobotEvent({ ...base, payload })).toBe(false)
    expect(isRobotEvent({ ...base, robot_id: null, payload })).toBe(false)
  })
})

describe('robotStatus', () => {
  it('descreve desligado, pausado, posicionado e aguardando', () => {
    const base = row('atlas', 0)
    expect(robotStatus({ ...base, enabled: false })).toBe('desligado')
    expect(robotStatus({ ...base, paused: true })).toBe('pausado')
    expect(robotStatus({ ...base, open_qty: 300 })).toBe('posicionado (300)')
    expect(robotStatus(base)).toBe('aguardando')
    const win = { symbol: 'WIN', name: 'Mini', proxy: '^BVSP', scale: 1, multiplier: 0.2 }
    expect(robotStatus({ ...base, instrument: win, open_qty: -2 })).toBe('vendido (2 contratos)')
    expect(robotStatus({ ...base, instrument: win, open_qty: 1 })).toBe('comprado (1 contrato)')
  })
})

describe('detailFor', () => {
  it('só usa o detalhe se for do robô selecionado (sem misturar contas)', () => {
    const a = { ...row('atlas', 0), orders: [], equity_curve: [] }
    expect(detailFor(a, 'atlas')).toBe(a)
    expect(detailFor(a, 'vega')).toBeNull()
    expect(detailFor(null, 'atlas')).toBeNull()
  })
})

describe('liveLabel', () => {
  const live = (days: number) => ({
    since: '2026-11-18T18:05:00-03:00',
    days,
    target_days: 90,
    remaining_days: Math.max(0, 90 - days),
    robot_return: 0,
    hold_return: null,
    beats_hold: null,
  })
  it('conta os dias até os 3 meses do critério', () => {
    expect(liveLabel(live(0))).toBe('ao vivo desde hoje · faltam 90 dias para 3 meses')
    expect(liveLabel(live(1))).toBe('ao vivo há 1 dia · faltam 89 dias para 3 meses')
    expect(liveLabel(live(95))).toBe('ao vivo há 95 dias · 3 meses completos')
    expect(liveLabel(live(89))).toBe('ao vivo há 89 dias · falta 1 dia para 3 meses')
    expect(liveDays(live(12))).toBe('12 de 90 dias')
    expect(liveDays(live(1))).toBe('1 de 90 dias')
  })
})

describe('rastreador', () => {
  const scanner = {
    ...row('orbita', 0),
    ticker: 'VARREDURA',
    universe: ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA'],
  }
  it('mostra quantos ativos ele varre e quantos tem em carteira', () => {
    expect(assetLabel(row('atlas', 0))).toBe('PETR4')
    expect(assetLabel(scanner)).toBe('rastreador · 3 ativos')
    expect(robotStatus({ ...scanner, open_qty: 2 })).toBe('2 ativos em carteira')
    expect(robotStatus({ ...scanner, open_qty: 1 })).toBe('1 ativo em carteira')
    expect(robotStatus(scanner)).toBe('aguardando')
  })
})
