/**
 * Ligação entre pontos 3D (âncoras) e etiquetas HTML desenhadas por cima do
 * canvas. A cada quadro o projetor converte a posição 3D em pixels de tela.
 *
 * Substitui o <Html> do drei, que cria uma raiz React por etiqueta e falha
 * no modo estrito do React 19.
 */
import { type Camera, type Object3D, Vector3 } from 'three'

export class LabelRegistry {
  readonly anchors = new Map<string, Object3D>()
  /** elemento HTML → âncora que ele segue */
  readonly elements = new Map<HTMLElement, string>()
  private readonly v = new Vector3()

  /**
   * Posiciona cada etiqueta sobre a projeção da sua âncora. Elementos com
   * `data-until` (balões, alertas) somem quando o prazo passa.
   */
  project(camera: Camera, width: number, height: number, now: number): void {
    for (const [el, anchorId] of this.elements) {
      const anchor = this.anchors.get(anchorId)
      if (!anchor) {
        el.style.visibility = 'hidden'
        continue
      }
      anchor.getWorldPosition(this.v).project(camera)
      const x = (this.v.x * 0.5 + 0.5) * width
      const y = (-this.v.y * 0.5 + 0.5) * height
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      const until = el.dataset.until
      el.style.visibility = until && Number(until) <= now ? 'hidden' : 'visible'
    }
  }

  setAnchor(id: string, obj: Object3D | null): void {
    if (obj) this.anchors.set(id, obj)
    else this.anchors.delete(id)
  }

  /** Callback de `ref` para um elemento que segue a âncora `anchorId`. */
  follow(anchorId: string): (el: HTMLElement | null) => void {
    let current: HTMLElement | null = null
    return (el) => {
      if (current) this.elements.delete(current)
      current = el
      if (el) this.elements.set(el, anchorId)
    }
  }
}
