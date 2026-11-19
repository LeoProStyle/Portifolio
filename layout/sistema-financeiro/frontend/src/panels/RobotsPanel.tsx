import { useState } from 'react'
import { api } from '../api/client'
import { FLOORS, floorRoom, pnlOf, signedMoney, tone } from '../office/office'
import { useRefreshOffice } from '../office/useOfficeData'
import { openRobot, useOfficeStore } from '../office/useOfficeStore'
import {
  assetLabel,
  liveDays,
  liveLabel,
  robotStatus,
  sortRobots,
  STRATEGY_LABEL,
  type RobotSort,
} from './robots'

const VIEW_LABEL = { fechados: 'fechado', abertos: 'aberto', ambos: 'total' } as const

/**
 * Tabela de robôs do andar: o MESMO conteúdo da cena 3D, em texto (acessível).
 * Cada robô tem conta SIMULADA própria. Pausar bloqueia só compras novas;
 * stops e alvos das posições continuam.
 */
export function RobotsPanel() {
  const floor = useOfficeStore((s) => s.floor)
  const pnlView = useOfficeStore((s) => s.pnlView)
  const building = useOfficeStore((s) => s.building)
  const robots = useOfficeStore((s) => s.robots)
  const selectedRobot = useOfficeStore((s) => s.selectedRobot)
  const refresh = useRefreshOffice()
  const [sortBy, setSortBy] = useState<RobotSort>('pnl')
  const [actionError, setActionError] = useState<string | null>(null)

  const f = FLOORS.find((x) => x.id === floor) ?? FLOORS[1]
  const room = building ? floorRoom(f, building.rooms) : null
  const source = f.room === null ? Object.values(robots).flat() : (robots[f.room] ?? [])
  const rows = sortRobots(source, sortBy)
  const title = f.room === null ? 'Todos os robôs do prédio' : `Robôs · ${f.label}`

  async function toggle(kind: 'robots' | 'rooms', id: string, paused: boolean) {
    setActionError(null)
    try {
      await api.setPaused(kind, id, paused)
      refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="panel robots" aria-label={title}>
      <header>
        <h2>{title}</h2>
        {room && (
          <span className="hint">
            sala:{' '}
            <span className={tone(room.day_pnl)}>
              hoje {signedMoney(room.day_pnl, room.currency)}
            </span>
          </span>
        )}
      </header>

      <div className="controls">
        <label>
          Ordenar{' '}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as RobotSort)}>
            <option value="pnl">P&amp;L total</option>
            <option value="day_pnl">P&amp;L do dia</option>
            <option value="name">Nome</option>
          </select>
        </label>
        {room && (
          <button type="button" onClick={() => void toggle('rooms', room.id, !room.paused)}>
            {room.paused ? `Retomar sala ${room.name}` : `Pausar sala ${room.name}`}
          </button>
        )}
      </div>

      {f.id === 'cripto' && (
        <p className="hint proxy-note" role="note">
          Cripto em dólar (US$ 20 mil por robô), só comprado, quantidade fracionária, 24 horas por
          dia. Preço agregado do yfinance (BTC-USD, ETH-USD, SOL-USD), não de uma corretora
          específica. O total do prédio converte para reais pela cotação do dólar do momento.
        </p>
      )}
      {f.id === 'minis' && (
        <p className="hint proxy-note" role="note">
          Minicontratos simulados por proxy: WIN ≈ ^BVSP (pontos) e WDO ≈ USDBRL=X × 1000. Sem base
          e sem rolagem de vencimento; custos e margem são estimativas. Os robôs compram e vendem a
          descoberto (só em simulação).
        </p>
      )}
      {room?.paused && (
        <p className="hint" role="status">
          Sala pausada ({room.reason}): sem compras novas; stops e alvos seguem valendo.
        </p>
      )}
      {actionError && <p className="error">Erro: {actionError}</p>}
      {!building && <p className="hint">Carregando robôs…</p>}
      {building && rows.length === 0 && <p className="hint">Nenhum robô neste andar ainda.</p>}

      {rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Robô</th>
                <th scope="col">Estratégia</th>
                <th scope="col">Ativo</th>
                <th scope="col" className="num">
                  P&amp;L {VIEW_LABEL[pnlView]}
                </th>
                <th scope="col" className="num">
                  Hoje
                </th>
                <th scope="col">Último sinal</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Ao vivo
                </th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = pnlOf(r, pnlView)
                return (
                  <tr key={r.id} className={r.id === selectedRobot ? 'selected' : undefined}>
                    <th scope="row">{r.name}</th>
                    <td>{STRATEGY_LABEL[r.strategy] ?? r.strategy}</td>
                    <td>{assetLabel(r)}</td>
                    <td className={`num ${tone(v)}`}>
                      {signedMoney(v, r.currency)}
                      {pnlView === 'ambos' && (
                        <>
                          <br />
                          <small>{(r.pnl_pct * 100).toFixed(2)}%</small>
                        </>
                      )}
                    </td>
                    <td className={`num ${tone(r.day_pnl)}`}>
                      {signedMoney(r.day_pnl, r.currency)}
                    </td>
                    <td title={r.last_reason ?? undefined}>
                      {r.last_signal ?? '—'}
                      {r.last_reason && <small className="reason">{r.last_reason}</small>}
                    </td>
                    <td>{robotStatus(r)}</td>
                    <td className="num" title={liveLabel(r.live)}>
                      {liveDays(r.live)}
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        onClick={() => openRobot(r)}
                        aria-label={`Ver painel de ${r.name}`}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggle('robots', r.id, !r.paused)}
                        aria-label={`${r.paused ? 'Retomar' : 'Pausar'} ${r.name}`}
                      >
                        {r.paused ? 'Retomar' : 'Pausar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
