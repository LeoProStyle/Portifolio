/** Carrega a sala 3D sob demanda, com plano B quando não há WebGL. */
import { Component, lazy, Suspense, type ReactNode } from 'react'

const Room3D = lazy(() => import('./Room3D'))

let webglSupport: boolean | null = null

/** Checa o suporte a WebGL UMA vez e libera o contexto de teste. */
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    webglSupport = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

const FALLBACK = (
  <p className="hint room-fallback">
    Não foi possível iniciar a sala 3D neste navegador (WebGL). A tabela de robôs, o status dos
    agentes e a linha do tempo continuam abaixo.
  </p>
)

class RoomErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn('Sala 3D indisponível; seguindo só com texto.', error)
  }

  render(): ReactNode {
    return this.state.failed ? FALLBACK : this.props.children
  }
}

export function RoomCanvas() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div
      className="room-host"
      role="img"
      aria-label="Escritório 3D: mesas dos robôs com placas de resultado simulado, ilha da Mesa IA e Diretoria. O mesmo conteúdo está na tabela de robôs e na linha do tempo."
    >
      {hasWebGL() ? (
        <RoomErrorBoundary>
          <Suspense fallback={<p className="hint room-fallback">Montando a sala…</p>}>
            <Room3D reducedMotion={reducedMotion} />
          </Suspense>
        </RoomErrorBoundary>
      ) : (
        FALLBACK
      )}
    </div>
  )
}
