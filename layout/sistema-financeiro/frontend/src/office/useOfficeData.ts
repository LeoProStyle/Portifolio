/** Carrega prédio, robôs e curvas de cada sala; recarrega a cada evento de robô e a cada 60 s. */
import { useEffect, useState } from 'react'
import { api, type EquityPoint } from '../api/client'
import type { RobotRow } from '../panels/robots'
import { useRoomStore } from '../store/useRoomStore'
import { useOfficeStore } from './useOfficeStore'

const REFRESH_MS = 60_000

export function useOfficeData(): void {
  const robotTick = useRoomStore((s) => s.robotTick)
  const cycles = useRoomStore((s) => s.cyclesFinished)
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTimer((n) => n + 1), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const { setData, setError } = useOfficeStore.getState()
    ;(async () => {
      const building = await api.building(ctrl.signal)
      const robots: Record<string, RobotRow[]> = {}
      const curves: Record<string, EquityPoint[]> = {}
      await Promise.all(
        building.rooms.map(async (room) => {
          const [rows, curve] = await Promise.all([
            api.roomRobots(room.id, ctrl.signal),
            api.roomEquity(room.id, ctrl.signal),
          ])
          robots[room.id] = rows
          curves[room.id] = curve
        }),
      )
      setData({ building, robots, curves })
    })().catch((err: unknown) => {
      if (ctrl.signal.aborted) return
      setError(err instanceof Error ? err.message : String(err))
    })
    return () => ctrl.abort()
  }, [robotTick, cycles, timer])
}

/** Força uma recarga (ex.: depois de pausar/retomar). */
export function useRefreshOffice(): () => void {
  return () => useRoomStore.setState((s) => ({ robotTick: s.robotTick + 1 }))
}
