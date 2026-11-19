import { describeEvent, formatTime } from '../lib/labels'
import { useRoomStore } from '../store/useRoomStore'

/** Linha do tempo legível. É a fonte de verdade da sala, não a animação. */
export function DecisionLog() {
  const log = useRoomStore((s) => s.log)
  const clearLog = useRoomStore((s) => s.clearLog)

  return (
    <section className="panel log" aria-label="Linha do tempo de eventos">
      <header>
        <h2>Linha do tempo</h2>
        <button type="button" onClick={clearLog} disabled={log.length === 0}>
          Limpar
        </button>
      </header>
      {log.length === 0 ? (
        <p className="empty">Nenhum evento ainda. Clique em “Rodar ciclo”.</p>
      ) : (
        <ol aria-live="polite">
          {log.map((ev, i) => (
            <li key={`${ev.ts}-${i}`} className={`ev ev-${ev.type}`}>
              <details>
                <summary>
                  <time dateTime={ev.ts}>{formatTime(ev.ts)}</time> {describeEvent(ev)}
                </summary>
                <pre>{JSON.stringify(ev, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
