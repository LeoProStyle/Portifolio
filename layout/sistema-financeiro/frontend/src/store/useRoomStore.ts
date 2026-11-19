import { create } from 'zustand'
import type { Interval } from '../lib/chartTime'
import type { ConnectionStatus } from '../ws/client'
import { isRobotEvent, type RoomEvent } from '../ws/types'
import { applyEvent, initialRoomState, loadHistory, type RoomState } from './roomReducer'

interface RoomStore extends RoomState {
  connection: ConnectionStatus
  ticker: string
  /** Ativos configurados no backend (sem o benchmark). */
  tickers: string[]
  benchmark: string | null
  interval: Interval
  /** Último evento recebido AO VIVO pelo WS (o histórico do banco não anima a sala). */
  lastLive: RoomEvent | null
  /** Conta eventos dos robôs do escritório (a tabela de robôs recarrega quando muda). */
  robotTick: number
  setConnection: (status: ConnectionStatus) => void
  setTicker: (ticker: string) => void
  setTickers: (tickers: string[], benchmark: string | null) => void
  setInterval: (interval: Interval) => void
  receive: (ev: RoomEvent) => void
  loadHistory: (events: RoomEvent[]) => void
  clearLog: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialRoomState,
  connection: 'connecting',
  ticker: 'PETR4.SA',
  tickers: ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA'],
  benchmark: '^BVSP',
  interval: '1d',
  lastLive: null,
  robotTick: 0,
  setConnection: (connection) => set({ connection }),
  setTicker: (ticker) => set({ ticker }),
  setTickers: (tickers, benchmark) => set({ tickers, benchmark }),
  setInterval: (interval) => set({ interval }),
  receive: (ev) =>
    set((s) =>
      // robôs do escritório têm conta própria: não mexem na sala/carteira da equipe de IA
      isRobotEvent(ev) ? { robotTick: s.robotTick + 1 } : { ...applyEvent(s, ev), lastLive: ev },
    ),
  loadHistory: (events) =>
    set((s) =>
      loadHistory(
        s,
        events.filter((e) => !isRobotEvent(e)),
      ),
    ),
  clearLog: () => set({ log: [] }),
}))
