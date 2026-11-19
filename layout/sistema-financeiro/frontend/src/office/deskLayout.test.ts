import { describe, expect, it } from 'vitest'
import { clampTarget, robotDesks } from './deskLayout'

describe('mesas dos robôs', () => {
  it.each([1, 5, 12, 15, 20])('%i mesas cabem no piso, à direita da ilha da Mesa IA', (n) => {
    const desks = robotDesks(n)
    expect(desks).toHaveLength(n)
    for (const d of desks) {
      expect(d.x - 0.95).toBeGreaterThanOrEqual(0.3) // ilha da Mesa IA fica em x < 0
      expect(d.x + 0.95).toBeLessThanOrEqual(10.5)
      expect(d.z - 0.6).toBeGreaterThanOrEqual(-7.6) // telão na parede do fundo
      expect(d.z + 0.85 + 0.35).toBeLessThanOrEqual(8) // cadeira dentro do piso
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const far =
          Math.abs(desks[i].x - desks[j].x) >= 2.3 || Math.abs(desks[i].z - desks[j].z) >= 2.5
        expect(far).toBe(true)
      }
  })

  it('mais de 20 é recusado (limite do spec por andar)', () => {
    expect(() => robotDesks(21)).toThrow()
  })
})

describe('limites da câmera', () => {
  it('mantém o alvo dentro do piso', () => {
    expect(clampTarget(0, 0)).toEqual([0, 0])
    expect(clampTarget(50, -50)).toEqual([9, -6])
  })
})
