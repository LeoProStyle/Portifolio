// Tipos e chamadas das rotas REST do backend (espelho de backend/app/main.py).
import type { Interval } from '../lib/chartTime'
import type { BacktestDetail, BacktestSummary } from '../panels/backtest'
import type { RobotRow } from '../panels/robots'
import type { PortfolioPayload } from '../ws/types'

export interface CandleDTO {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Ponto de curva de patrimônio (time = epoch em segundos). */
export interface EquityPoint {
  time: number
  value: number
}

export interface PointDTO {
  time: string
  value: number
}

export interface PricesResponse {
  ticker: string
  interval: Interval
  as_of: string
  candles: CandleDTO[]
  sma20: PointDTO[]
  sma50: PointDTO[]
}

export interface IndicatorsResponse {
  ticker: string
  interval: Interval
  as_of: string
  last_candle: CandleDTO | null
  sma20?: number | null
  sma50?: number | null
  ema9?: number | null
  rsi14?: number | null
  macd?: { macd: number | null; signal: number | null; hist: number | null }
  atr14?: number | null
  vol20?: number | null
  candles_used?: number
}

export interface NewsItemDTO {
  id: string
  ticker: string
  title: string
  link: string
  source: string
  published: string
  summary: string
}

export interface NewsResponse {
  ticker: string
  as_of: string
  items: NewsItemDTO[]
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`Erro ${resp.status} em ${url}`)
  return (await resp.json()) as T
}

async function postJson(url: string): Promise<void> {
  const resp = await fetch(url, { method: 'POST' })
  if (!resp.ok) throw new Error(`Erro ${resp.status} em ${url}`)
}

const enc = encodeURIComponent

export const api = {
  prices: (ticker: string, interval: Interval, days: number, signal?: AbortSignal) =>
    getJson<PricesResponse>(`/api/prices/${enc(ticker)}?interval=${interval}&days=${days}`, signal),
  indicators: (ticker: string, signal?: AbortSignal) =>
    getJson<IndicatorsResponse>(`/api/indicators/${enc(ticker)}`, signal),
  news: (ticker: string, signal?: AbortSignal) =>
    getJson<NewsResponse>(`/api/news/${enc(ticker)}?days=7`, signal),
  portfolio: (signal?: AbortSignal) => getJson<PortfolioResponse>('/api/portfolio', signal),
  orders: (ticker: string, status: OrderDTO['status'], signal?: AbortSignal) =>
    getJson<{ orders: OrderDTO[] }>(
      `/api/orders?ticker=${enc(ticker)}&status=${status}&limit=200`,
      signal,
    ),
  events: (signal?: AbortSignal) => getJson<{ events: unknown[] }>('/api/events?limit=300', signal),
  building: (signal?: AbortSignal) => getJson<BuildingResponse>('/api/building', signal),
  roomRobots: (room: string, signal?: AbortSignal) =>
    getJson<RobotRow[]>(`/api/rooms/${enc(room)}/robots`, signal),
  roomEquity: (room: string, signal?: AbortSignal) =>
    getJson<EquityPoint[]>(`/api/rooms/${enc(room)}/equity`, signal),
  robot: (id: string, signal?: AbortSignal) =>
    getJson<RobotDetail>(`/api/robots/${enc(id)}`, signal),
  /** Pausa/retoma COMPRAS novas de um robô ou sala (stops e alvos seguem valendo). */
  setPaused: (kind: 'robots' | 'rooms', id: string, paused: boolean) =>
    postJson(`/api/${kind}/${enc(id)}/${paused ? 'pause' : 'resume'}`),
  backtests: (robotId: string, signal?: AbortSignal) =>
    getJson<BacktestSummary[]>(`/api/robots/${enc(robotId)}/backtests`, signal),
  backtest: (runId: string, signal?: AbortSignal) =>
    getJson<BacktestDetail>(`/api/backtests/${enc(runId)}`, signal),
  /** Roda o replay histórico do robô numa conta separada (pode levar alguns segundos). */
  runBacktest: async (robotId: string, start: string, end: string): Promise<BacktestSummary> => {
    const resp = await fetch(`/api/robots/${enc(robotId)}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end }),
    })
    if (!resp.ok) {
      const body = (await resp.json().catch(() => null)) as { detail?: unknown } | null
      throw new Error(typeof body?.detail === 'string' ? body.detail : `Erro ${resp.status}`)
    }
    return (await resp.json()) as BacktestSummary
  },
  runCycle: async (ticker: string): Promise<void> => {
    const resp = await fetch('/api/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    })
    if (!resp.ok) {
      const body = (await resp.json().catch(() => null)) as { detail?: unknown } | null
      throw new Error(typeof body?.detail === 'string' ? body.detail : `Erro ${resp.status}`)
    }
  },
}

export interface OrderDTO {
  id: string
  cycle_id: string | null
  ticker: string
  side: 'COMPRA' | 'VENDA'
  qty: number
  stop: number | null
  reason: 'decisao' | 'stop' | 'alvo'
  status: 'pending' | 'filled' | 'rejected'
  created_at: string
  filled_at: string | null
  filled_qty: number | null
  fill_price: number | null
  fee: number | null
  note: string
}

/** Robô com ordens e curva de patrimônio (painel lateral). time = epoch em segundos. */
export interface RobotDetail extends RobotRow {
  orders: OrderDTO[]
  equity_curve: EquityPoint[]
}

export interface PortfolioResponse extends PortfolioPayload {
  daily_pnl_pct: number
  pending_orders: OrderDTO[]
  as_of: string
}

/** Moeda das contas de uma sala (o prédio soma tudo em reais). */
export type Currency = 'BRL' | 'USD'

export interface RoomSummary {
  id: string
  name: string
  currency: Currency
  /** Reais por unidade da moeda no instante (BRL = 1); null = sem cotação. */
  fx_rate: number | null
  equity_brl: number | null
  day_pnl_brl: number | null
  robots: number
  equity: number
  day_pnl: number
  day_pnl_pct: number
  paused: boolean
  reason: string | null
}

export interface BuildingResponse {
  rooms: RoomSummary[]
  /** Alguma sala em moeda estrangeira ficou fora do total (sem cotação). */
  fx_missing: boolean
  equity: number
  day_pnl: number
  paused: boolean
  reason: string | null
  as_of: string
}
