import { isRoomEvent, type RoomEvent } from './types'

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

interface Options {
  url: string
  onEvent: (ev: RoomEvent) => void
  onStatus: (status: ConnectionStatus) => void
  minDelayMs?: number
  maxDelayMs?: number
}

/** Atraso exponencial com jitter: 1s, 2s, 4s... até o máximo. */
export function backoffDelay(attempt: number, min: number, max: number): number {
  const base = Math.min(max, min * 2 ** attempt)
  return Math.round(base / 2 + Math.random() * (base / 2))
}

export function defaultWsUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined
  if (fromEnv) return fromEnv
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

/** Conexão WS com reconexão automática. Retorna uma função para encerrar. */
export function connectRoom({
  url,
  onEvent,
  onStatus,
  minDelayMs = 1000,
  maxDelayMs = 15000,
}: Options): () => void {
  let socket: WebSocket | null = null
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const open = () => {
    onStatus('connecting')
    socket = new WebSocket(url)

    socket.onopen = () => {
      attempt = 0
      onStatus('open')
    }

    socket.onmessage = (msg) => {
      try {
        const data: unknown = JSON.parse(String(msg.data))
        if (isRoomEvent(data)) onEvent(data)
        else console.warn('Evento fora do contrato ignorado:', data)
      } catch {
        console.warn('Mensagem WS inválida ignorada')
      }
    }

    socket.onclose = () => {
      socket = null
      onStatus('closed')
      if (stopped) return
      timer = setTimeout(open, backoffDelay(attempt++, minDelayMs, maxDelayMs))
    }
  }

  open()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    socket?.close()
  }
}
