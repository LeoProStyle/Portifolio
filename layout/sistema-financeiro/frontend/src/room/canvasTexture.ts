/** Texturas desenhadas num <canvas> (textos e gráficos sem fonte/arquivo externo). */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export interface CanvasTextureOptions {
  /** Repetição da textura (ex.: piso em ladrilhos). */
  repeat?: [number, number]
}

export function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
  options: CanvasTextureOptions = {},
): THREE.CanvasTexture {
  const [rx, ry] = options.repeat ?? [1, 1]
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    if (rx !== 1 || ry !== 1) {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(rx, ry)
    }
    return tex
  }, [width, height, rx, ry])

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    texture.needsUpdate = true
    // `draw` muda a cada render; quem chama controla a atualização por `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, ...deps])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
