import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { money } from '../office/office'
import { useApi } from '../lib/useApi'
import {
  benchmarkLabel,
  checkLabel,
  curveTime,
  fmtPct,
  periodRange,
  type BacktestDetail,
  type CurvePoint,
} from './backtest'
import { STRATEGY_LABEL, type RobotRow } from './robots'

const YEARS = [1, 2, 3] as const

function day(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/')
}

async function loadRobots(signal: AbortSignal): Promise<RobotRow[]> {
  const building = await api.building(signal)
  const rooms = await Promise.all(building.rooms.map((r) => api.roomRobots(r.id, signal)))
  // Mesa IA fica fora do backtest (sem notícias históricas; o LLM "conhece" o passado)
  // rastreadores ainda não têm backtest (são avaliados ao vivo contra a cesta igual)
  return rooms.flat().filter((r) => r.strategy !== 'mesa_ia' && r.universe.length === 0)
}

/** Curva do robô × comprar e segurar o ativo, no mesmo capital inicial. */
function EquityChart({ detail }: { detail: BacktestDetail }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#1c1f2b' }, textColor: '#d8dbe6' },
      grid: { vertLines: { color: '#262a3a' }, horzLines: { color: '#262a3a' } },
      rightPriceScale: { borderColor: '#2e3344' },
      timeScale: { borderColor: '#2e3344' },
    })
    const toLine = (pts: CurvePoint[]) =>
      pts.map((p) => ({ time: curveTime(p.time, detail.interval), value: p.value }))
    chart
      .addSeries(LineSeries, { color: '#5aa9e6', lineWidth: 1, title: 'Comprar e segurar' })
      .setData(toLine(detail.benchmark_curve))
    chart
      .addSeries(LineSeries, { color: '#f2c14e', lineWidth: 2, title: detail.robot_name })
      .setData(toLine(detail.equity_curve))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [detail])

  return (
    <div
      ref={ref}
      className="bt-chart"
      role="img"
      aria-label={`Patrimônio de ${detail.robot_name} comparado a comprar e segurar ${detail.ticker}`}
    />
  )
}

function Result({ detail }: { detail: BacktestDetail }) {
  const m = detail.metrics
  const v = detail.verdict
  return (
    <div className="bt-result">
      <p className={`bt-verdict ${v.passed ? 'up' : 'down'}`} role="status">
        {v.passed ? 'Passou nas checagens do backtest' : 'Não passou nas checagens do backtest'} ·{' '}
        {detail.robot_name} · {day(detail.start)} a {day(detail.end)}
      </p>
      <ul className="bt-checks">
        {v.checks.map((c) => (
          <li key={c.name} className={c.ok === null ? '' : c.ok ? 'up' : 'down'}>
            <strong>{checkLabel(c.ok)}</strong> — {c.label} <small>({c.detail})</small>
          </li>
        ))}
      </ul>
      <p className="hint">{v.note}</p>

      <dl className="bt-metrics">
        <dt>Retorno do robô</dt>
        <dd className={m.total_return >= 0 ? 'up' : 'down'}>{fmtPct(m.total_return)}</dd>
        <dt>Comprar e segurar {detail.ticker.replace('.SA', '')}</dt>
        <dd>{fmtPct(m.asset_return)}</dd>
        <dt>{benchmarkLabel(detail.benchmark)}</dt>
        <dd>{fmtPct(m.index_return)}</dd>
        <dt>Drawdown máximo</dt>
        <dd className="down">{fmtPct(-m.max_drawdown)}</dd>
        <dt>Operações fechadas</dt>
        <dd>
          {m.trades} ({m.wins} ganhos · {m.losses} perdas)
        </dd>
        <dt>Taxa de acerto</dt>
        <dd>{m.win_rate === null ? '—' : fmtPct(m.win_rate).replace('+', '')}</dd>
        <dt>Fator de lucro</dt>
        <dd>{m.profit_factor === null ? '—' : m.profit_factor.toFixed(2).replace('.', ',')}</dd>
        <dt>Custos pagos (taxas + slippage)</dt>
        <dd>{money(m.costs_paid, detail.currency ?? 'BRL')}</dd>
        <dt>Patrimônio final</dt>
        <dd>{money(m.final_equity, detail.currency ?? 'BRL')}</dd>
        <dt>Custo de LLM</dt>
        <dd>{money(m.llm_cost, 'USD')}</dd>
      </dl>

      <EquityChart detail={detail} />
    </div>
  )
}

/**
 * Backtest por robô: replay histórico numa conta SIMULADA separada, sem ver o futuro.
 * Não mexe na conta ao vivo nem no P&L do escritório.
 */
export function BacktestPanel() {
  const robots = useApi(loadRobots, 'robots')
  const [robotId, setRobotId] = useState<string | null>(null)
  const [years, setYears] = useState<(typeof YEARS)[number]>(2)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const current = robotId ?? robots.data?.[0]?.id ?? null
  const history = useApi(
    (signal) => (current ? api.backtests(current, signal) : Promise.resolve([])),
    `${current ?? ''}|${refresh}`,
  )
  const runId = selected ?? history.data?.[0]?.run_id ?? null
  const detail = useApi(
    (signal) => (runId ? api.backtest(runId, signal) : Promise.resolve(null)),
    runId ?? '',
  )

  async function run() {
    if (!current) return
    setRunning(true)
    setRunError(null)
    try {
      const { start, end } = periodRange(years, new Date())
      const res = await api.runBacktest(current, start, end)
      setSelected(res.run_id)
      setRefresh((n) => n + 1)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="panel backtest" aria-label="Backtest por robô">
      <header>
        <h2>Backtest por robô</h2>
        <span className="hint">conta separada · sem ver o futuro</span>
      </header>

      <div className="controls">
        <label>
          Robô{' '}
          <select
            value={current ?? ''}
            onChange={(e) => {
              setRobotId(e.target.value)
              setSelected(null)
            }}
          >
            {(robots.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {STRATEGY_LABEL[r.strategy] ?? r.strategy} ·{' '}
                {r.ticker.replace('.SA', '')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Período{' '}
          <select
            value={years}
            onChange={(e) => setYears(Number(e.target.value) as (typeof YEARS)[number])}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                últimos {y} {y === 1 ? 'ano' : 'anos'}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void run()} disabled={!current || running}>
          {running ? 'Rodando…' : 'Rodar backtest'}
        </button>
      </div>

      {(runError ?? robots.error ?? history.error ?? detail.error) && (
        <p className="error" role="alert">
          Erro: {runError ?? robots.error ?? history.error ?? detail.error}
        </p>
      )}
      {running && (
        <p className="hint" role="status">
          Rodando o replay dia a dia… pode levar alguns segundos.
        </p>
      )}

      {detail.data ? (
        <Result detail={detail.data} />
      ) : (
        !history.loading && <p className="hint">Nenhum backtest deste robô ainda.</p>
      )}

      {history.data && history.data.length > 1 && (
        <details className="bt-history">
          <summary>Backtests anteriores ({history.data.length})</summary>
          <ul>
            {history.data.map((b) => (
              <li key={b.run_id}>
                <button
                  type="button"
                  className="linklike"
                  aria-current={b.run_id === runId ? 'true' : undefined}
                  onClick={() => setSelected(b.run_id)}
                >
                  {day(b.start)} a {day(b.end)} · {fmtPct(b.metrics.total_return)} ·{' '}
                  {b.verdict.passed ? 'passou' : 'não passou'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="hint bt-warning">
        Limitações: o resultado passado não garante o futuro. Taxas e slippage são simulados e a
        execução é na abertura do candle seguinte. Robôs de regras não usam LLM; a Mesa IA fica fora
        do backtest porque o LLM pode "conhecer" o período pelo treinamento, o que inflaria o
        resultado. Passar aqui não libera conta real.
      </p>
    </section>
  )
}
