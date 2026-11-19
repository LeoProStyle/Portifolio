import { describe, expect, it } from 'vitest'
import type { BuildingResponse } from '../api/client'
import type { RobotRow } from '../panels/robots'
import {
  activeRows,
  FLOORS,
  floorRoom,
  initialCash,
  managerLine,
  normalizeSpark,
  operatorLook,
  pnlOf,
  ranking,
  signedBrl,
  signedMoney,
  sumPnl,
  sumPnlBrl,
  tone,
} from './office'

function row(id: string, realized: number, unrealized: number): RobotRow {
  return {
    id,
    name: id.toUpperCase(),
    room: 'acoes',
    strategy: 'sma_cross',
    ticker: 'PETR4.SA',
    interval: '1d',
    run_id: `${id}-1`,
    initial_cash: 100_000,
    equity: 100_000 + realized + unrealized,
    pnl: realized + unrealized,
    pnl_pct: 0,
    realized_pnl: realized,
    unrealized_pnl: unrealized,
    day_pnl: 0,
    day_pnl_pct: 0,
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
    open_qty: 0,
    last_signal: null,
    last_reason: null,
    last_decision_ts: null,
    enabled: true,
    paused: false,
  }
}

const building = (over: Partial<BuildingResponse> = {}): BuildingResponse => ({
  rooms: [
    {
      id: 'acoes',
      name: 'Ações B3',
      robots: 6,
      equity: 600_000,
      day_pnl: 1234.5,
      day_pnl_pct: 0.002,
      paused: false,
      reason: null,
      currency: 'BRL',
      fx_rate: 1,
      equity_brl: 600_000,
      day_pnl_brl: 1234.5,
    },
  ],
  fx_missing: false,
  equity: 600_000,
  day_pnl: 1234.5,
  paused: false,
  reason: null,
  as_of: '2026-11-19T18:00:00-03:00',
  ...over,
})

describe('andares', () => {
  it('todos os andares ligados; cada um na sua sala', () => {
    expect(FLOORS.map((f) => f.id)).toEqual(['diretoria', 'acoes', 'minis', 'cripto'])
    expect(FLOORS.filter((f) => f.soon).map((f) => f.id)).toEqual([])
    const acoes = FLOORS.find((f) => f.id === 'acoes')!
    const minis = FLOORS.find((f) => f.id === 'minis')!
    expect(floorRoom(acoes, building().rooms)?.name).toBe('Ações B3')
    expect(floorRoom(minis, building().rooms)).toBeNull() // sala não veio do backend
    const withMinis = [...building().rooms, { ...building().rooms[0], id: 'minis', name: 'Minis' }]
    expect(floorRoom(minis, withMinis)?.name).toBe('Minis')
    expect(floorRoom(acoes, [])).toBeNull()
  })
})

describe('P&L fechado × aberto', () => {
  it('escolhe a parte certa e soma', () => {
    const r = row('a', 100, -30)
    expect(pnlOf(r, 'fechados')).toBe(100)
    expect(pnlOf(r, 'abertos')).toBe(-30)
    expect(pnlOf(r, 'ambos')).toBe(70)
    expect(sumPnl([r, row('b', -10, 5)], 'ambos')).toBe(65)
    expect(sumPnl([], 'ambos')).toBe(0)
  })

  it('formata com sinal e cor', () => {
    expect(signedBrl(1234.5).replace(/\s/g, ' ')).toBe('+R$ 1.234,50')
    expect(signedBrl(-330.34).replace(/\s/g, ' ')).toBe('-R$ 330,34')
    expect(signedBrl(-0).replace(/\s/g, ' ')).toBe('+R$ 0,00')
    expect(signedBrl(-0.001).replace(/\s/g, ' ')).toBe('+R$ 0,00')
    expect([tone(5), tone(-5), tone(0), tone(0.001)]).toEqual(['up', 'down', 'flat', 'flat'])
  })

  it('ranking do maior para o menor, limitado a n', () => {
    const rows = [row('a', 1, 0), row('b', 50, 0), row('c', -20, 0)]
    expect(ranking(rows, 'ambos', 2).map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('Gerente Geral', () => {
  it('fala só com dados do prédio', () => {
    expect(managerLine(building()).replace(/\s/g, ' ')).toBe(
      'Prédio hoje +R$ 1.234,50 · nenhum limite atingido.',
    )
    const roomPaused = building({
      rooms: [{ ...building().rooms[0], paused: true, reason: 'perda do dia 3%' }],
    })
    expect(managerLine(roomPaused)).toContain('Ações B3 pausada: perda do dia 3%')
    expect(managerLine(building({ paused: true, reason: 'pausa manual' }))).toContain(
      'Prédio pausado: pausa manual',
    )
  })
})

describe('aparência dos operadores', () => {
  it('é estável por robô, casual e aceita ajuste do YAML', () => {
    const a = operatorLook('atlas')
    expect(operatorLook('atlas')).toEqual(a)
    expect(a.suit).toBeFalsy()
    expect(a.hair).toMatch(/^#/)
    const looks = new Set(
      ['atlas', 'orion', 'vega', 'rigel', 'nova'].map((id) => operatorLook(id).shirt),
    )
    expect(looks.size).toBeGreaterThan(2)
    expect(operatorLook('atlas', { shirt: '#123456' }).shirt).toBe('#123456')
  })
})

describe('mini-curva', () => {
  it('normaliza para [0,1] sem NaN', () => {
    expect(normalizeSpark([])).toEqual([0.5, 0.5])
    expect(normalizeSpark([5])).toEqual([0.5, 0.5])
    expect(normalizeSpark([7, 7, 7])).toEqual([0.5, 0.5, 0.5])
    expect(normalizeSpark([100, 110, 105])).toEqual([0, 1, 0.5])
  })
})

describe('robôs que contam no prédio', () => {
  it('desligados ficam fora do resultado e do capital inicial (como no /api/building)', () => {
    const off = { ...row('off', 0, 0), enabled: false, initial_cash: 100_000 }
    const on = row('on', 50, 0)
    expect(activeRows([on, off]).map((r) => r.id)).toEqual(['on'])
    expect(sumPnl(activeRows([on, off]), 'ambos')).toBe(50)
    expect(initialCash([on, off])).toBe(100_000)
  })
})

describe('moedas (cripto em dólar)', () => {
  it('formata pela moeda da sala', () => {
    expect(signedMoney(1234.5, 'USD').replace(/\s/g, ' ')).toBe('+US$ 1.234,50')
    expect(signedMoney(-2, 'BRL').replace(/\s/g, ' ')).toBe('-R$ 2,00')
  })

  it('soma o resultado em reais pela cotação de cada sala; sala sem cotação fica fora', () => {
    const rooms = [
      { ...building().rooms[0], id: 'acoes', currency: 'BRL' as const, fx_rate: 1 },
      { ...building().rooms[0], id: 'cripto', currency: 'USD' as const, fx_rate: 5 },
    ]
    const robots = { acoes: [row('a', 100, 0)], cripto: [row('c', 10, 0)] }
    expect(sumPnlBrl(robots, rooms, 'ambos')).toBe(100 + 10 * 5)
    const noFx = [rooms[0], { ...rooms[1], fx_rate: null }]
    expect(sumPnlBrl(robots, noFx, 'ambos')).toBe(100)
  })

  it('Gerente Geral avisa quando falta a cotação do dólar', () => {
    expect(managerLine(building({ fx_missing: true }))).toContain('cotação do dólar')
  })
})
