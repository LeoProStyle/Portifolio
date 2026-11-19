import { api } from '../api/client'
import { useApi } from '../lib/useApi'
import { useRoomStore } from '../store/useRoomStore'

function when(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Manchetes que o Agente Notícias vai ler (últimos 7 dias, só RSS). */
export function NewsPanel() {
  const ticker = useRoomStore((s) => s.ticker)
  const cyclesFinished = useRoomStore((s) => s.cyclesFinished)
  const { data, error, loading } = useApi(
    (signal) => api.news(ticker, signal),
    `${ticker}|${cyclesFinished}`,
  )

  return (
    <section className="panel news" aria-label="Notícias">
      <h2>Notícias · {ticker}</h2>
      {loading && <p className="hint">Lendo feeds…</p>}
      {error && <p className="error">Erro: {error}</p>}
      {data && data.items.length === 0 && (
        <p className="hint">Nenhuma manchete nos últimos 7 dias.</p>
      )}
      {data && data.items.length > 0 && (
        <ul>
          {data.items.map((n) => (
            <li key={n.id}>
              <a href={n.link} target="_blank" rel="noopener noreferrer">
                {n.title}
              </a>
              <span className="meta">
                {n.source} · <time dateTime={n.published}>{when(n.published)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
