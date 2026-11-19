import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { toChartTime } from '../lib/chartTime'
import { useApi } from '../lib/useApi'
import { useRoomStore } from '../store/useRoomStore'

const DAYS = { '1d': 180, '1h': 30 } as const

interface Series {
  candles: ISeriesApi<'Candlestick'>
  sma20: ISeriesApi<'Line'>
  sma50: ISeriesApi<'Line'>
  markers: ISeriesMarkersPluginApi<Time>
}

/** Gráfico de candles (lightweight-charts). Médias vêm prontas do backend. */
export function PriceChart() {
  const ticker = useRoomStore((s) => s.ticker)
  const interval = useRoomStore((s) => s.interval)
  const cyclesFinished = useRoomStore((s) => s.cyclesFinished)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<Series | null>(null)

  const { data, error, loading } = useApi(
    (signal) => api.prices(ticker, interval, DAYS[interval], signal),
    `${ticker}|${interval}|${cyclesFinished}`,
  )
  const fills = useApi(
    (signal) => api.orders(ticker, 'filled', signal),
    `${ticker}|${cyclesFinished}`,
  )

  // cria o gráfico uma vez
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#1c1f2b' }, textColor: '#d8dbe6' },
      grid: { vertLines: { color: '#262a3a' }, horzLines: { color: '#262a3a' } },
      rightPriceScale: { borderColor: '#2e3344' },
      timeScale: { borderColor: '#2e3344' },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#5ec27a',
      downColor: '#e2645a',
      borderVisible: false,
      wickUpColor: '#5ec27a',
      wickDownColor: '#e2645a',
    })
    seriesRef.current = {
      candles,
      sma20: chart.addSeries(LineSeries, { color: '#f2c14e', lineWidth: 1, title: 'MM20' }),
      sma50: chart.addSeries(LineSeries, { color: '#5aa9e6', lineWidth: 1, title: 'MM50' }),
      markers: createSeriesMarkers(candles, []),
    }
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // atualiza os dados
  useEffect(() => {
    const s = seriesRef.current
    if (!s || !data) return
    s.candles.setData(
      data.candles.map((c) => ({
        time: toChartTime(c.time, data.interval),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    s.sma20.setData(
      data.sma20.map((p) => ({ time: toChartTime(p.time, data.interval), value: p.value })),
    )
    s.sma50.setData(
      data.sma50.map((p) => ({ time: toChartTime(p.time, data.interval), value: p.value })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // marcadores das ordens simuladas executadas (só no diário: execução é em candle diário)
  useEffect(() => {
    const s = seriesRef.current
    if (!s || !data) return
    if (data.interval !== '1d' || !fills.data) {
      s.markers.setMarkers([])
      return
    }
    const days = new Set(data.candles.map((c) => c.time.slice(0, 10)))
    const markers: SeriesMarker<Time>[] = fills.data.orders
      .filter((o) => o.filled_at && days.has(o.filled_at.slice(0, 10)))
      .map((o) => {
        const buy = o.side === 'COMPRA'
        return {
          time: toChartTime(o.filled_at as string, '1d'),
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? '#5ec27a' : '#e2645a',
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: `${o.reason === 'stop' ? 'Stop' : buy ? 'C' : 'V'} ${o.filled_qty ?? o.qty}`,
        } satisfies SeriesMarker<Time>
      })
      .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    s.markers.setMarkers(markers)
  }, [data, fills.data])

  const last = data?.candles.at(-1)
  return (
    <section className="panel chart" aria-label={`Gráfico de ${ticker}`}>
      <header>
        <h2>
          {ticker} · {interval === '1d' ? 'diário' : '1 hora'}
        </h2>
        <span className="legend">
          <span className="sw sw-20" /> MM20 <span className="sw sw-50" /> MM50
        </span>
      </header>
      <div ref={containerRef} className="chart-box" />
      <p className="hint" role="status">
        {loading && 'Carregando candles…'}
        {error && <span className="error">Não foi possível carregar: {error}</span>}
        {!loading && !error && data && data.candles.length === 0 && 'Sem candles para o período.'}
        {!loading && !error && last && (
          <>
            Último candle fechado: {last.time.slice(0, 16).replace('T', ' ')} · fechamento R${' '}
            {last.close.toFixed(2)} · fonte Yahoo Finance (atrasada, só para estudo)
          </>
        )}
      </p>
    </section>
  )
}
