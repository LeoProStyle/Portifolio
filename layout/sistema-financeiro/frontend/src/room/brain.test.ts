import { describe, expect, it } from 'vitest'
import { CharacterBrain, TALK_MS } from './brain'

const HOME = { x: 10, y: 10 }

describe('CharacterBrain', () => {
  it('começa parado em casa', () => {
    const b = new CharacterBrain(HOME)
    expect(b.mode).toBe('idle')
    expect(b.pos).toEqual(HOME)
  })

  it('idle → working → talking → idle', () => {
    const b = new CharacterBrain(HOME)
    b.work()
    expect(b.mode).toBe('working')
    b.finish()
    expect(b.mode).toBe('talking')
    b.update(TALK_MS - 1)
    expect(b.mode).toBe('talking')
    b.update(2)
    expect(b.mode).toBe('idle')
  })

  it('anda até o alvo, espera trabalhando e volta para casa', () => {
    const b = new CharacterBrain(HOME, 50)
    b.visit({ x: 60, y: 10 }, 1000)
    expect(b.mode).toBe('walking')
    b.update(500) // 25 px
    expect(b.pos.x).toBeCloseTo(35)
    expect(b.facing).toBe(1)
    b.update(500) // chegou
    expect(b.pos).toEqual({ x: 60, y: 10 })
    expect(b.mode).toBe('working')
    b.update(1000) // terminou de "digitar" no terminal
    expect(b.mode).toBe('walking')
    expect(b.facing).toBe(-1)
    b.update(2000)
    expect(b.pos).toEqual(HOME)
    expect(b.mode).toBe('idle')
  })

  it('pedido de trabalho durante a caminhada vale ao chegar em casa', () => {
    const b = new CharacterBrain(HOME, 50)
    b.visit({ x: 20, y: 10 }, 0)
    b.work()
    expect(b.mode).toBe('walking')
    b.update(10_000)
    expect(b.mode).toBe('working')
  })

  it('sem animação (movimento reduzido) teletransporta', () => {
    const b = new CharacterBrain(HOME, Infinity)
    b.visit({ x: 90, y: 40 }, 1000)
    b.update(1)
    expect(b.pos).toEqual({ x: 90, y: 40 })
    expect(b.mode).toBe('working')
    b.update(1000)
    expect(b.pos).toEqual(HOME)
  })

  it('reset volta para casa parado', () => {
    const b = new CharacterBrain(HOME, 50)
    b.visit({ x: 90, y: 40 }, 500)
    b.update(100)
    b.reset()
    expect(b.mode).toBe('idle')
    expect(b.pos).toEqual(HOME)
  })
})
