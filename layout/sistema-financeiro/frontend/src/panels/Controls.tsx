import { useEffect, useState } from 'react'
import type { Interval } from '../lib/chartTime'
import { api } from '../api/client'
import { useRoomStore } from '../store/useRoomStore'

export function Controls() {
  const [error, setError] = useState<string | null>(null)
  const stocks = useRoomStore((s) => s.tickers)
  const benchmark = useRoomStore((s) => s.benchmark)
  const setTickers = useRoomStore((s) => s.setTickers)
  const tickers = benchmark ? [...stocks, benchmark] : stocks
  const ticker = useRoomStore((s) => s.ticker)
  const setTicker = useRoomStore((s) => s.setTicker)
  const interval = useRoomStore((s) => s.interval)
  const setInterval = useRoomStore((s) => s.setInterval)
  const activeCycle = useRoomStore((s) => s.activeCycle)
  const connection = useRoomStore((s) => s.connection)

  useEffect(() => {
    fetch('/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { tickers?: string[]; benchmark?: string }) => {
        if (body.tickers?.length) {
          setTickers(body.tickers, body.benchmark ?? null)
          if (!body.tickers.includes(useRoomStore.getState().ticker)) setTicker(body.tickers[0])
        }
      })
      .catch(() => {
        /* backend fora do ar: mantém a lista padrão */
      })
  }, [setTicker, setTickers])

  async function runCycle() {
    setError(null)
    try {
      await api.runCycle(ticker)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível falar com o backend.')
    }
  }

  const busy = activeCycle !== null
  const isBenchmark = ticker.startsWith('^')
  return (
    <section className="panel controls" aria-label="Controles">
      <label>
        Ticker{' '}
        <select value={ticker} onChange={(e) => setTicker(e.target.value)} disabled={busy}>
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Candle{' '}
        <select value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
          <option value="1d">diário</option>
          <option value="1h">1 hora</option>
        </select>
      </label>
      <button
        type="button"
        onClick={runCycle}
        disabled={busy || connection !== 'open' || isBenchmark}
        title={isBenchmark ? 'O índice é só referência; escolha uma ação' : undefined}
      >
        {busy ? 'Ciclo em andamento…' : 'Rodar ciclo'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
