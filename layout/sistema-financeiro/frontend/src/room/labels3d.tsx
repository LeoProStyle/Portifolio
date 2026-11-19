/** Âncoras 3D (dentro do canvas) e projetor das etiquetas HTML. */
import { useFrame } from '@react-three/fiber'
import type { LabelRegistry } from './labelRegistry'

/** Ponto invisível na cena que uma etiqueta HTML segue. */
export function Anchor({
  registry,
  id,
  y = 0,
}: {
  registry: LabelRegistry
  id: string
  y?: number
}) {
  return <group position={[0, y, 0]} ref={(obj) => registry.setAnchor(id, obj)} />
}

/** A cada quadro, reposiciona as etiquetas HTML sobre suas âncoras. */
export function LabelProjector({ registry, now }: { registry: LabelRegistry; now: () => number }) {
  useFrame(({ camera, size }) => registry.project(camera, size.width, size.height, now()))
  return null
}
