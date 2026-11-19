/**
 * Onde fica a mesa de cada robô no andar (unidades do mundo, ≈ metros).
 * A ilha da Mesa IA ocupa x < 0; as mesas dos robôs ficam à direita, em fileiras.
 */
import type { Spot } from '../room/layout3d'

/** Limite de robôs por andar (spec §11: até cerca de 20). */
export const MAX_DESKS = 20

const ROW_Z0 = -4.4
const ROW_STEP = 2.7

export function robotDesks(n: number): Spot[] {
  if (n > MAX_DESKS) throw new Error(`máximo de ${MAX_DESKS} robôs por andar`)
  const cols = n <= 15 ? 3 : 4
  const x0 = cols === 3 ? 1.8 : 1.3
  const step = cols === 3 ? 3.0 : 2.45
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % cols) * step,
    z: ROW_Z0 + Math.floor(i / cols) * ROW_STEP,
  }))
}

/** Alvo da câmera (arrastar) preso ao retângulo do piso. */
export function clampTarget(x: number, z: number): [number, number] {
  return [Math.min(9, Math.max(-9, x)), Math.min(6, Math.max(-6, z))]
}
