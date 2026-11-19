/**
 * Planta da sala 3D em unidades do mundo (≈ metros).
 * Piso: x ∈ [-11, 11], z ∈ [-8, 8]. Paredes no fundo: x = -11 e z = -8.
 * A câmera isométrica fica em (+x, +y, +z) olhando para o centro.
 *
 * O CharacterBrain trabalha em 2D: Point.x = mundo x, Point.y = mundo z.
 */
import type { Point } from './brain'
import type { RoomAgent } from './director'

export const ROOM = { minX: -11, maxX: 11, minZ: -8, maxZ: 8, wallH: 3.2 }

export interface Spot {
  x: number
  z: number
}

/** Mesas dos agentes (o boneco senta do lado da câmera, olhando para os monitores). */
export const AGENT_DESKS: Record<RoomAgent, Spot> = {
  news: { x: -6.2, z: -2.6 },
  chart: { x: -2.6, z: -2.6 },
  risk: { x: -6.2, z: 1.4 },
  manager: { x: -2.6, z: 1.4 },
}

export const AGENT_LABELS: Record<RoomAgent, string> = {
  news: 'Notícias',
  chart: 'Gráfico',
  risk: 'Risco',
  manager: 'Gestor',
}

/** Distância entre a mesa e a cadeira. */
export const SEAT_OFFSET = 0.85

export function seatOf(desk: Spot): Point {
  return { x: desk.x, y: desk.z + SEAT_OFFSET }
}

/** Terminal de ordens, encostado na parede do fundo. */
export const TERMINAL: Spot = { x: -4.4, z: -7.2 }
export const TERMINAL_SPOT: Point = { x: TERMINAL.x, y: TERMINAL.z + 0.9 }

/** Telão na parede do fundo (curva de patrimônio da sala), acima das mesas dos robôs. */
export const BIG_SCREEN = { x: 5.0, y: 1.9, z: -7.92, w: 6.4, h: 2.4 }

/** Placa com o nome da sala, entre o terminal e o telão. */
export const ROOM_SIGN = { x: -1.3, y: 2.45, w: 2.9, h: 0.72 }

/** Centro da ilha da Mesa IA (tapete e placa de P&L da equipe de agentes). */
export const ISLAND = { x: -4.4, z: -0.6 }

/** Diretoria: mesa do CEO (de frente para a câmera), Gerente Geral ao lado. */
export const CEO_DESK: Spot = { x: -0.6, z: -3.4 }
export const CEO_SEAT: Point = { x: CEO_DESK.x, y: CEO_DESK.z - SEAT_OFFSET }
export const GG_SPOT: Point = { x: 2.6, y: -1.2 }
export const BOARD_SCREEN = { x: 0.6, y: 1.75, z: -7.92, w: 6.4, h: 2.2 }

/** Velocidade de caminhada (unidades por segundo). */
export const WALK_SPEED = 1.6
