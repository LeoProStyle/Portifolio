import { useEffect } from 'react'
import { api } from './api/client'
import { useOfficeData } from './office/useOfficeData'
import { AgentsBoard } from './panels/AgentsBoard'
import { BacktestPanel } from './panels/BacktestPanel'
import { Controls } from './panels/Controls'
import { DecisionLog } from './panels/DecisionLog'
import { HUD } from './panels/HUD'
import { IndicatorsPanel } from './panels/IndicatorsPanel'
import { NewsPanel } from './panels/NewsPanel'
import { Portfolio } from './panels/Portfolio'
import { PriceChart } from './panels/PriceChart'
import { RobotDetail } from './panels/RobotDetail'
import { RobotsPanel } from './panels/RobotsPanel'
import { RoomCanvas } from './room/RoomCanvas'
import { useRoomStore } from './store/useRoomStore'
import { connectRoom, defaultWsUrl } from './ws/client'
import { isRoomEvent } from './ws/types'

export default function App() {
  useOfficeData()

  useEffect(() => {
    const { receive, setConnection } = useRoomStore.getState()
    return connectRoom({ url: defaultWsUrl(), onEvent: receive, onStatus: setConnection })
  }, [])

  // histórico gravado no backend (linha do tempo sobrevive a recarregar a página)
  useEffect(() => {
    const ctrl = new AbortController()
    api
      .events(ctrl.signal)
      .then(({ events }) => useRoomStore.getState().loadHistory(events.filter(isRoomEvent)))
      .catch(() => {
        /* sem histórico: segue só com os eventos ao vivo */
      })
    return () => ctrl.abort()
  }, [])

  return (
    <div className="app">
      <HUD />

      <main>
        <section className="office" aria-label="Andar do escritório">
          <div className="panel floor-view">
            <RoomCanvas />
          </div>
          <RobotDetail />
        </section>

        <div className="office-table">
          <RobotsPanel />
        </div>

        <h2 className="section-title">Mesa IA · equipe de agentes e ferramentas</h2>
        <div className="grid">
          <div className="col">
            <Controls />
            <PriceChart />
            <AgentsBoard />
          </div>
          <div className="col">
            <Portfolio />
            <BacktestPanel />
            <IndicatorsPanel />
            <NewsPanel />
            <DecisionLog />
          </div>
        </div>
      </main>

      <footer className="disclaimer">
        Simulação educacional. Não é recomendação de investimento.
      </footer>
    </div>
  )
}
