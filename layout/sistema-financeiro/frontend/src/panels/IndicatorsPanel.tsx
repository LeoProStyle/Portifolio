import { api } from '../api/client'
import { useApi } from '../lib/useApi'
import { useRoomStore } from '../store/useRoomStore'

function fmt(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? '—' : v.toFixed(digits)
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`
}

/** O que o Agente Gráfico vai receber: números calculados em código, não pelo LLM. */
export function IndicatorsPanel() {
  const ticker = useRoomStore((s) => s.ticker)
  const cyclesFinished = useRoomStore((s) => s.cyclesFinished)
  const { data, error, loading } = useApi(
    (signal) => api.indicators(ticker, signal),
    `${ticker}|${cyclesFinished}`,
  )

  const rows: [string, string, string][] = data
    ? [
        ['Fechamento', `R$ ${fmt(data.last_candle?.close)}`, 'último candle completo'],
        ['MM20', fmt(data.sma20), 'média simples de 20'],
        ['MM50', fmt(data.sma50), 'média simples de 50'],
        ['MME9', fmt(data.ema9), 'média exponencial de 9'],
        ['IFR14', fmt(data.rsi14, 1), '>70 sobrecompra · <30 sobrevenda'],
        [
          'MACD',
          fmt(data.macd?.macd, 3),
          `sinal ${fmt(data.macd?.signal, 3)} · hist ${fmt(data.macd?.hist, 3)}`,
        ],
        ['ATR14', fmt(data.atr14), 'amplitude média (usada no stop)'],
        ['Vol. 20d', pct(data.vol20), 'volatilidade anualizada'],
      ]
    : []

  return (
    <section className="panel indicators" aria-label="Indicadores técnicos">
      <h2>Indicadores · {ticker}</h2>
      {loading && <p className="hint">Calculando…</p>}
      {error && <p className="error">Erro: {error}</p>}
      {data && !data.last_candle && <p className="hint">Sem dados de preço.</p>}
      {data?.last_candle && (
        <>
          <table>
            <tbody>
              {rows.map(([name, value, help]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td className="num">{value}</td>
                  <td className="help">{help}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Calculados em código (pandas/numpy) com {data.candles_used} candles até{' '}
            {data.last_candle.time.slice(0, 10)}.
          </p>
        </>
      )}
    </section>
  )
}
