import { ACTIVE_AGENTS, AGENT_LABEL, STATUS_LABEL } from '../lib/labels'
import { useRoomStore } from '../store/useRoomStore'

/** Status em texto da equipe de IA (a animação fica na ilha da Mesa IA, no andar de Ações). */
export function AgentsBoard() {
  const agents = useRoomStore((s) => s.agents)
  const activeCycle = useRoomStore((s) => s.activeCycle)
  const lastDecision = useRoomStore((s) => s.lastDecision)
  const veto = useRoomStore((s) => s.veto)

  return (
    <section className={`panel room ${activeCycle ? 'lit' : ''}`} aria-label="Equipe de agentes">
      <h2>
        Equipe de agentes {activeCycle ? `· ciclo de ${activeCycle.ticker}` : '· aguardando ciclo'}
      </h2>
      <ul className="agents" aria-label="Status dos agentes">
        {ACTIVE_AGENTS.map((name) => {
          const a = agents[name]
          return (
            <li key={name} className={`agent status-${a.status}`}>
              <strong>{AGENT_LABEL[name]}</strong>
              <span className="status">{STATUS_LABEL[a.status]}</span>
              {name === 'risk' && veto && (
                <span className="stop-sign" role="alert" title={veto}>
                  PARE
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {lastDecision && (
        <p className={`decision action-${lastDecision.action}`}>
          Última decisão: <strong>{lastDecision.action}</strong> {lastDecision.ticker}
          {lastDecision.qty > 0 && ` · ${lastDecision.qty} ações`}
        </p>
      )}
    </section>
  )
}
