import { describe, expect, it } from 'vitest'
import { createRoomFx, BUBBLE_MS } from './fx'

function setup() {
  let t = 1000
  const fx = createRoomFx({ reducedMotion: false, now: () => t })
  return { fx, advance: (ms: number) => (t += ms), now: () => t }
}

describe('createRoomFx', () => {
  it('começa com luz apagada e todos parados nas cadeiras', () => {
    const { fx } = setup()
    expect(fx.store.getState().lights).toBe(false)
    expect(fx.brains.manager.mode).toBe('idle')
  })

  it('luz acende no início do ciclo e baixa a placa PARE', () => {
    const { fx } = setup()
    fx.apply({ kind: 'veto', reason: 'x' })
    expect(fx.store.getState().veto).toBe('x')
    fx.apply({ kind: 'lights', on: true })
    expect(fx.store.getState().lights).toBe(true)
    expect(fx.store.getState().veto).toBeNull()
  })

  it('balão guarda texto e validade', () => {
    const { fx, now } = setup()
    fx.apply({ kind: 'say', agent: 'news', text: 'olá' })
    const b = fx.store.getState().bubbles.news
    expect(b?.text).toBe('olá')
    expect(b?.until).toBe(now() + BUBBLE_MS)
  })

  it('trabalho, fim e ida ao terminal mexem no cérebro do boneco', () => {
    const { fx } = setup()
    fx.apply({ kind: 'work', agent: 'chart' })
    expect(fx.brains.chart.mode).toBe('working')
    fx.apply({ kind: 'finish', agent: 'chart' })
    expect(fx.brains.chart.mode).toBe('talking')
    fx.apply({ kind: 'toTerminal', action: 'COMPRA' })
    expect(fx.brains.manager.mode).toBe('walking')
  })

  it('ordem executada pisca o terminal com a cor do lado', () => {
    const { fx } = setup()
    fx.apply({ kind: 'terminalFlash', side: 'VENDA' })
    expect(fx.store.getState().flash?.side).toBe('VENDA')
  })

  it('alerta de erro e fim de ciclo', () => {
    const { fx } = setup()
    fx.apply({ kind: 'alert', agent: 'risk' })
    expect(fx.store.getState().alerts.risk).toBeGreaterThan(0)
    fx.apply({ kind: 'work', agent: 'news' })
    fx.apply({ kind: 'lights', on: false })
    fx.apply({ kind: 'allIdle' })
    expect(fx.store.getState().lights).toBe(false)
    expect(fx.brains.news.mode).toBe('idle')
  })
})
