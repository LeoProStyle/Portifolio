import type { Time, UTCTimestamp } from 'lightweight-charts'
import type { Interval } from '../lib/chartTime'

/** Espelho de app/backtest/metrics.py (Metrics). */
export interface BacktestMetrics {
  initial_cash: number
  final_equity: number
  total_return: number
  max_drawdown: number
  trades: number
  wins: number
  losses: number
  win_rate: number | null
  profit_factor: number | null
  avg_trade: number | null
  fees_paid: number
  slippage_paid: number
  costs_paid: number
  asset_return: number | null
  index_return: number | null
  excess_vs_asset: number | null
  excess_vs_index: number | null
  llm_cost: number
}

export interface VerdictCheck {
  name: string
  label: string
  ok: boolean | null
  detail: string
}

export interface BacktestSummary {
  run_id: string
  robot_id: string
  robot_name: string
  strategy: string
  ticker: string
  interval: Interval
  start: string
  end: string
  period_days: number
  steps: number
  created_ts: number
  benchmark: string
  /** Moeda da conta do robô (resultados antigos não têm: BRL). */
  currency?: 'BRL' | 'USD'
  metrics: BacktestMetrics
  verdict: { passed: boolean; checks: VerdictCheck[]; note: string }
}

export interface CurvePoint {
  time: number // unix (s)
  value: number
}

export interface BacktestDetail extends BacktestSummary {
  benchmark_curve: CurvePoint[]
  equity_curve: CurvePoint[]
  fills: { time: string; side: string; qty: number; price: number; fee: number; reason: string }[]
}

const BRT_OFFSET_S = 3 * 3600 // Brasília sem horário de verão desde 2019

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Período "últimos N anos" até hoje, em datas locais (YYYY-MM-DD). */
export function periodRange(years: number, today: Date): { start: string; end: string } {
  const start = new Date(today)
  start.setFullYear(today.getFullYear() - years)
  return { start: ymd(start), end: ymd(today) }
}

export function checkLabel(ok: boolean | null): string {
  if (ok === null) return 'sem dados'
  return ok ? 'passou' : 'não passou'
}

/** Instante da curva no formato do lightweight-charts (exibido no horário de Brasília). */
export function curveTime(ts: number, interval: Interval): Time {
  const shifted = ts - BRT_OFFSET_S
  if (interval === '1d') return new Date(shifted * 1000).toISOString().slice(0, 10)
  return shifted as UTCTimestamp
}

export function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const s = `${(v * 100).toFixed(2)}%`.replace('.', ',')
  return v >= 0 ? `+${s}` : s
}

/** Nome legível do benchmark do backtest (depende da sala do robô). */
export function benchmarkLabel(benchmark: string): string {
  if (benchmark === '^BVSP') return 'Ibovespa'
  if (benchmark === 'BTC-USD') return 'Bitcoin (BTC-USD)'
  return benchmark
}
