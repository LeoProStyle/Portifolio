import type { Time, UTCTimestamp } from 'lightweight-charts'

export type Interval = '1d' | '1h'

/**
 * Converte o ISO do backend (com fuso -03:00) para o formato do lightweight-charts.
 * - 1d: string 'YYYY-MM-DD' (data de negócio, sem risco de mudar de dia pelo fuso)
 * - 1h: timestamp deslocado pelo fuso do próprio ISO, porque o gráfico exibe em UTC
 */
export function toChartTime(iso: string, interval: Interval): Time {
  if (interval === '1d') return iso.slice(0, 10)
  const match = /([+-])(\d{2}):(\d{2})$/.exec(iso)
  const offsetS = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 3600 + Number(match[3]) * 60)
    : 0
  return (Math.floor(Date.parse(iso) / 1000) + offsetS) as UTCTimestamp
}
