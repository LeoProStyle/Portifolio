import { FLOORS, floorRoom, signedBrl, sumPnlBrl, tone, type PnlView } from '../office/office'
import { useOfficeStore } from '../office/useOfficeStore'
import { useRoomStore } from '../store/useRoomStore'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const CONNECTION_LABEL = {
  connecting: 'conectando…',
  open: 'conectado',
  closed: 'desconectado (tentando de novo)',
} as const

const VIEWS: { id: PnlView; label: string; hint: string }[] = [
  { id: 'fechados', label: 'Fechados', hint: 'resultado das operações já encerradas (com taxas)' },
  { id: 'abertos', label: 'Abertos', hint: 'resultado das posições ainda abertas' },
  { id: 'ambos', label: 'Ambos', hint: 'fechados + abertos' },
]

/** Barra fixa do escritório: andares, resultado do prédio e visão de P&L. */
export function HUD() {
  const connection = useRoomStore((s) => s.connection)
  const floor = useOfficeStore((s) => s.floor)
  const setFloor = useOfficeStore((s) => s.setFloor)
  const pnlView = useOfficeStore((s) => s.pnlView)
  const setPnlView = useOfficeStore((s) => s.setPnlView)
  const building = useOfficeStore((s) => s.building)
  const error = useOfficeStore((s) => s.error)
  const robots = useOfficeStore((s) => s.robots)
  const pnl = building ? sumPnlBrl(robots, building.rooms, pnlView) : 0
  const has = building !== null

  return (
    <header className="hud">
      <div className="hud-row">
        <h1>
          Escritório <span className="hud-sub">de pregão</span>
        </h1>
        <nav className="floors" aria-label="Andares">
          {FLOORS.map((f) => {
            const room = building ? floorRoom(f, building.rooms) : null
            const disabled = f.soon || (f.room !== null && has && room === null)
            return (
              <button
                key={f.id}
                type="button"
                className="floor-btn"
                aria-pressed={floor === f.id}
                disabled={disabled}
                title={f.soon ? 'Em breve (Etapas 5 e 6)' : undefined}
                onClick={() => setFloor(f.id)}
              >
                {f.label}
                {f.soon && <small> em breve</small>}
                {room?.paused && <small> pausada</small>}
              </button>
            )
          })}
        </nav>
        <span className="badge" title="Somente paper trading: nenhuma ordem real é enviada">
          ● simulado
        </span>
        <span className={`conn conn-${connection}`} role="status">
          ● {CONNECTION_LABEL[connection]}
        </span>
      </div>
      <div className="hud-row hud-numbers">
        <div className="hud-stat">
          <span className="hud-label">Patrimônio total</span>
          <strong className="hud-big">{has ? brl.format(building.equity) : '—'}</strong>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Hoje</span>
          <strong className={`hud-mid ${has ? tone(building.day_pnl) : ''}`}>
            {has ? `${signedBrl(building.day_pnl)} ${building.day_pnl >= 0 ? '▲' : '▼'}` : '—'}
          </strong>
        </div>
        <div className="hud-stat">
          <span className="hud-label">
            Resultado {VIEWS.find((v) => v.id === pnlView)?.label.toLowerCase()}
          </span>
          <strong className={`hud-mid ${has ? tone(pnl) : ''}`}>
            {has ? signedBrl(pnl) : '—'}
          </strong>
        </div>
        <div className="seg" role="group" aria-label="Quais resultados somar">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={pnlView === v.id}
              title={v.hint}
              onClick={() => setPnlView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {building?.fx_missing && (
          <span className="hud-alert" role="status">
            Sem cotação do dólar: a sala em dólar ficou fora do total.
          </span>
        )}
        {building?.paused && (
          <span className="hud-alert" role="alert">
            Prédio pausado: {building.reason}
          </span>
        )}
        {error && (
          <span className="error">
            {has ? 'Dados podem estar desatualizados' : 'Sem dados do escritório'}: {error}
          </span>
        )}
      </div>
    </header>
  )
}
