import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import { LabelRegistry } from './labelRegistry'

describe('LabelRegistry', () => {
  it('registra e remove âncoras', () => {
    const r = new LabelRegistry()
    const obj = new Object3D()
    r.setAnchor('a', obj)
    expect(r.anchors.get('a')).toBe(obj)
    r.setAnchor('a', null)
    expect(r.anchors.has('a')).toBe(false)
  })

  it('elemento segue a âncora e é esquecido ao desmontar', () => {
    const r = new LabelRegistry()
    const ref = r.follow('agent:news')
    const el = {} as HTMLElement
    ref(el)
    expect(r.elements.get(el)).toBe('agent:news')
    ref(null)
    expect(r.elements.size).toBe(0)
  })
})
