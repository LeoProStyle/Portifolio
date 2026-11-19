/** Estado do escritório: andar, robô selecionado, visão de P&L e dados da API. */
import { create } from 'zustand'
import type { BuildingResponse, EquityPoint } from '../api/client'
import type { RobotRow } from '../panels/robots'
import { useRoomStore } from '../store/useRoomStore'
import type { FloorId, PnlView } from './office'

export interface OfficeState {
  floor: FloorId
  pnlView: PnlView
  selectedRobot: string | null
  building: BuildingResponse | null
  /** Robôs por sala (id da sala no office.yaml). */
  robots: Record<string, RobotRow[]>
  /** Curva de patrimônio somada de cada sala (telão). */
  curves: Record<string, EquityPoint[]>
  error: string | null
  setFloor: (floor: FloorId) => void
  setPnlView: (view: PnlView) => void
  select: (id: string | null) => void
  setData: (data: Pick<OfficeState, 'building' | 'robots' | 'curves'>) => void
  setError: (error: string | null) => void
}

export const useOfficeStore = create<OfficeState>((set) => ({
  floor: 'acoes',
  pnlView: 'ambos',
  selectedRobot: null,
  building: null,
  robots: {},
  curves: {},
  error: null,
  // trocar de andar fecha o painel do robô (ele pode nem existir no outro andar)
  setFloor: (floor) => set({ floor, selectedRobot: null }),
  setPnlView: (pnlView) => set({ pnlView }),
  select: (selectedRobot) => set({ selectedRobot }),
  setData: (data) => set({ ...data, error: null }),
  setError: (error) => set({ error }),
}))

/** Linha do robô selecionado (em qualquer sala); `null` se nada selecionado ou se ele sumiu. */
export function selectedRow(s: Pick<OfficeState, 'robots' | 'selectedRobot'>): RobotRow | null {
  if (!s.selectedRobot) return null
  for (const rows of Object.values(s.robots)) {
    const found = rows.find((r) => r.id === s.selectedRobot)
    if (found) return found
  }
  return null
}

/**
 * Abre o painel do robô (clique na mesa, na placa ou em "Ver") e faz o gráfico,
 * os indicadores e as notícias da página seguirem o ativo dele.
 */
export function openRobot(row: Pick<RobotRow, 'id' | 'ticker'>): void {
  useOfficeStore.getState().select(row.id)
  // o gráfico/indicadores/notícias são de ações (TICKERS); minicontrato não troca o ativo
  const room = useRoomStore.getState()
  if (room.tickers.includes(row.ticker)) room.setTicker(row.ticker)
}

/** Todos os robôs do prédio (Diretoria). */
export function allRobots(s: Pick<OfficeState, 'robots'>): RobotRow[] {
  return Object.values(s.robots).flat()
}
