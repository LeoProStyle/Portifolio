import { describe, expect, it } from 'vitest'
import { backoffDelay } from './client'

describe('backoffDelay', () => {
  it('cresce exponencialmente e respeita o máximo', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const base = Math.min(15000, 1000 * 2 ** attempt)
      const d = backoffDelay(attempt, 1000, 15000)
      expect(d).toBeGreaterThanOrEqual(base / 2)
      expect(d).toBeLessThanOrEqual(base)
    }
  })
})
