/**
 * Modelos 3D low-poly ORIGINAIS, montados com primitivas (caixas, cilindros).
 * Nenhum modelo, textura ou fonte de terceiros (regra nº 7).
 */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { CharacterBrain, Point } from './brain'
import { useCanvasTexture } from './canvasTexture'
import { GOLD } from './gold'
import type { Look } from './look'

// ---------- mobília ----------

const STEEL = '#5d6578'
const DARK = '#23262f'
const DESK_TOP = '#15171e'

/** Filete de luz dourada (caixa fina emissiva, sem sombra). */
export function GoldStrip({
  position,
  size,
  intensity = 1,
}: {
  position: [number, number, number]
  size: [number, number, number]
  intensity?: number
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={GOLD.clone().multiplyScalar(intensity)} toneMapped={false} />
    </mesh>
  )
}

/** Mesa preta com filete dourado na borda (lado de quem senta, voltado para a câmera). */
export function Desk({ x, z, w = 1.7 }: { x: number; z: number; w?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.06, 0.8]} />
        <meshStandardMaterial color={DESK_TOP} roughness={0.35} metalness={0.2} />
      </mesh>
      <GoldStrip position={[0, 0.715, 0.401]} size={[w, 0.015, 0.01]} intensity={0.7} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (w / 2 - 0.06), 0.37, 0]} castShadow>
          <boxGeometry args={[0.06, 0.74, 0.7]} />
          <meshStandardMaterial color="#1c1f28" />
        </mesh>
      ))}
      {/* painel frontal (lado da parede) */}
      <mesh position={[0, 0.5, -0.36]}>
        <boxGeometry args={[w - 0.1, 0.42, 0.03]} />
        <meshStandardMaterial color="#1f222c" />
      </mesh>
    </group>
  )
}

/** Monitor cuja tela é uma textura (mini-curva, texto do robô). */
export function ScreenMonitor({
  x,
  z,
  y = 0.77,
  map,
  turn = 0,
}: {
  x: number
  z: number
  y?: number
  map: THREE.Texture
  /** Giro em torno do eixo vertical (monitores laterais virados para o operador). */
  turn?: number
}) {
  return (
    <group position={[x, y, z]} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.12]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.04, 0.16, 0.04]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.62, 0.38, 0.04]} />
        <meshStandardMaterial color="#0d0f14" />
      </mesh>
      <mesh position={[0, 0.38, 0.022]}>
        <planeGeometry args={[0.57, 0.33]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Monitor({
  x,
  z,
  y = 0.77,
  color,
  emissive = 0.6,
}: {
  x: number
  z: number
  y?: number
  color: string
  emissive?: number
}) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.12]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.04, 0.16, 0.04]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.56, 0.34, 0.04]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {/* tela virada para quem está sentado (lado +z) */}
      <mesh position={[0, 0.36, 0.022]}>
        <planeGeometry args={[0.5, 0.28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
      </mesh>
    </group>
  )
}

export function Chair({ x, z, turn = 0 }: { x: number; z: number; turn?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.46, 0.07, 0.44]} />
        <meshStandardMaterial color="#2e3240" />
      </mesh>
      <mesh position={[0, 0.78, 0.22]} castShadow>
        <boxGeometry args={[0.44, 0.6, 0.07]} />
        <meshStandardMaterial color="#2e3240" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.04, 5]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
    </group>
  )
}

export function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.16, 0.44, 8]} />
        <meshStandardMaterial color="#e6e1d8" />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color="#4f9d5d" flatShading />
      </mesh>
      <mesh position={[0.12, 1.05, 0.05]} castShadow>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#5fb36d" flatShading />
      </mesh>
    </group>
  )
}

export function WaterCooler({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.36, 1, 0.36]} />
        <meshStandardMaterial color="#f2f4f7" />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.44, 10]} />
        <meshStandardMaterial color="#7fc4f0" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// ---------- personagens ----------

export type { Look }

export interface PersonProps {
  look: Look
  brain: CharacterBrain
  /** O que o boneco faz quando está trabalhando na mesa. */
  workStyle: 'type' | 'read'
  reducedMotion: boolean
  /** `stand` = sempre em pé (ex.: Gerente Geral ao lado da mesa do CEO). */
  pose?: 'auto' | 'stand'
  /** Para onde olha quando parado (radianos; padrão π = de frente para a mesa, −z). */
  facing?: number
  /** Elementos presos acima da cabeça (balão, etiqueta, placa). */
  children?: React.ReactNode
}

const HEAD_Y_SEATED = 1.28
const HEAD_Y_STANDING = 1.62

function near(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.05
}

/** Boneco articulado. Posição, pose e animação vêm do CharacterBrain. */
export function Person({
  look,
  brain,
  workStyle,
  reducedMotion,
  pose = 'auto',
  facing = Math.PI,
  children,
}: PersonProps) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const seatedLegs = useRef<THREE.Group>(null)
  const standLegs = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Mesh>(null)
  const legR = useRef<THREE.Mesh>(null)
  const paper = useRef<THREE.Mesh>(null)
  const top = useRef<THREE.Group>(null)
  const last = useRef<Point>({ ...brain.pos })

  useFrame((state, delta) => {
    const g = root.current
    if (!g || !body.current || !head.current || !armL.current || !armR.current) return
    brain.update(Math.min(delta, 0.1) * 1000)
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    const { pos, mode } = brain
    const seated = pose === 'auto' && mode !== 'walking' && near(pos, brain.home)

    // direção: andando olha para onde vai; parado olha para a mesa/terminal (−z)
    const dx = pos.x - last.current.x
    const dz = pos.y - last.current.y
    let heading = facing
    if (mode === 'walking' && Math.hypot(dx, dz) > 1e-4) heading = Math.atan2(dx, dz)
    const diff = Math.atan2(Math.sin(heading - g.rotation.y), Math.cos(heading - g.rotation.y))
    g.rotation.y += diff * Math.min(1, delta * 10)
    last.current = { ...pos }
    g.position.set(pos.x, 0, pos.y)

    // corpo: sentado ou em pé
    body.current.position.y = seated ? 0 : 0.34
    if (seatedLegs.current) seatedLegs.current.visible = seated
    if (standLegs.current) standLegs.current.visible = !seated

    // pernas andando
    const swing = mode === 'walking' ? Math.sin(t * 10) * 0.6 : 0
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing

    // braços
    let aL = 0
    let aR = 0
    if (mode === 'walking') {
      aL = -swing * 0.8
      aR = swing * 0.8
    } else if (mode === 'working') {
      if (workStyle === 'read' && seated) {
        aL = aR = -1.05
      } else {
        aL = -1.15 + Math.sin(t * 16) * 0.12
        aR = -1.15 + Math.sin(t * 16 + 1.7) * 0.12
      }
    }
    armL.current.rotation.x = aL
    armR.current.rotation.x = aR

    // cabeça: fala balança, parado respira
    head.current.rotation.x = mode === 'talking' ? Math.sin(t * 9) * 0.12 : 0
    body.current.scale.y = mode === 'idle' ? 1 + Math.sin(t * 2) * 0.012 : 1

    if (paper.current) {
      paper.current.visible = workStyle === 'read' && mode === 'working' && seated
      paper.current.rotation.y = Math.sin(t * 3) * 0.25
    }
    if (top.current) top.current.position.y = (seated ? HEAD_Y_SEATED : HEAD_Y_STANDING) + 0.42
  })

  const mat = (color: string, extra?: Partial<THREE.MeshStandardMaterialParameters>) => (
    <meshStandardMaterial
      color={color}
      roughness={look.robot ? 0.35 : 0.8}
      metalness={look.robot ? 0.4 : 0}
      {...extra}
    />
  )

  return (
    <group ref={root} position={[brain.pos.x, 0, brain.pos.y]} rotation={[0, Math.PI, 0]}>
      <group ref={body}>
        {/* tronco (com terno: paletó por cima e camisa em "V" na frente) */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[0.46, 0.5, 0.28]} />
          {mat(look.suit ?? look.shirt)}
        </mesh>
        {look.suit && (
          <mesh position={[0, 0.9, 0.142]}>
            <boxGeometry args={[0.16, 0.3, 0.01]} />
            {mat(look.shirt)}
          </mesh>
        )}
        <mesh position={[0, 0.88, look.suit ? 0.149 : 0.145]}>
          <boxGeometry args={[look.suit ? 0.05 : 0.08, 0.3, 0.01]} />
          {mat(look.detail)}
        </mesh>
        {/* cabeça */}
        <group ref={head} position={[0, 1.08, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.34, 0.34, 0.32]} />
            {mat(look.skin)}
          </mesh>
          {look.hair ? (
            <>
              <mesh position={[0, 0.39, -0.02]}>
                <boxGeometry args={[0.37, 0.1, 0.36]} />
                {mat(look.hair)}
              </mesh>
              <mesh position={[0, 0.27, -0.17]}>
                <boxGeometry args={[0.37, 0.24, 0.04]} />
                {mat(look.hair)}
              </mesh>
            </>
          ) : (
            // careca: topo da cabeça liso, com um leve brilho
            <mesh position={[0, 0.375, 0]}>
              <boxGeometry args={[0.3, 0.02, 0.28]} />
              <meshStandardMaterial color={look.skin} roughness={0.25} />
            </mesh>
          )}
          {look.glasses && (
            // óculos de grau: armação escura e lentes CLARAS (não escuras)
            <group position={[0, 0.23, 0.168]}>
              {[-0.08, 0.08].map((ex) => (
                <group key={ex} position={[ex, 0, 0]}>
                  <mesh>
                    <boxGeometry args={[0.12, 0.09, 0.008]} />
                    <meshStandardMaterial color="#1b1d24" />
                  </mesh>
                  <mesh position={[0, 0, 0.005]}>
                    <planeGeometry args={[0.095, 0.065]} />
                    <meshStandardMaterial
                      color="#dff3ff"
                      transparent
                      opacity={0.55}
                      roughness={0.05}
                    />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[0.05, 0.015, 0.008]} />
                <meshStandardMaterial color="#1b1d24" />
              </mesh>
            </group>
          )}
          {look.robot ? (
            <>
              <mesh position={[0, 0.22, 0.165]}>
                <boxGeometry args={[0.24, 0.08, 0.01]} />
                <meshStandardMaterial color="#5ce1e6" emissive="#5ce1e6" emissiveIntensity={1.2} />
              </mesh>
              <mesh position={[0, 0.52, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
                {mat(STEEL)}
              </mesh>
              <mesh position={[0, 0.62, 0]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={1} />
              </mesh>
            </>
          ) : (
            [-0.08, 0.08].map((ex) => (
              <mesh key={ex} position={[ex, 0.22, 0.162]}>
                <boxGeometry args={[0.05, 0.05, 0.01]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            ))
          )}
        </group>
        {/* braços (pivô no ombro) */}
        {(
          [
            [armL, -0.3],
            [armR, 0.3],
          ] as const
        ).map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 1.0, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.12, 0.42, 0.13]} />
              {mat(look.suit ?? look.shirt)}
            </mesh>
            <mesh position={[0, -0.44, 0]}>
              <boxGeometry args={[0.1, 0.08, 0.1]} />
              {mat(look.skin)}
            </mesh>
          </group>
        ))}
        {/* jornal (Notícias lendo) */}
        <mesh ref={paper} position={[0, 0.92, 0.42]} visible={false}>
          <boxGeometry args={[0.5, 0.36, 0.01]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
        {/* pernas sentado */}
        <group ref={seatedLegs}>
          {[-0.11, 0.11].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.52, 0.2]} castShadow>
                <boxGeometry args={[0.16, 0.14, 0.42]} />
                {mat(look.pants)}
              </mesh>
              <mesh position={[x, 0.26, 0.4]} castShadow>
                <boxGeometry args={[0.14, 0.44, 0.14]} />
                {mat(look.pants)}
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {/* pernas em pé (fora do corpo para não subir junto) */}
      <group ref={standLegs} visible={false}>
        {(
          [
            [legL, -0.11],
            [legR, 0.11],
          ] as const
        ).map(([ref, x]) => (
          <mesh key={x} ref={ref} position={[x, 0.55, 0]} castShadow>
            <boxGeometry args={[0.16, 0.56, 0.16]} />
            {mat(look.pants)}
          </mesh>
        ))}
      </group>
      {/* acima da cabeça: o grupo não gira junto com a ordem dos filhos */}
      <group ref={top} position={[0, HEAD_Y_SEATED + 0.42, 0]}>
        {children}
      </group>
    </group>
  )
}

// ---------- placa PARE ----------

export function StopSign({ visible }: { visible: boolean }) {
  const tex = useCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#d32f2f'
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4
        ctx.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 6
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 38px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('PARE', w / 2, h / 2 + 2)
    },
    [],
  )
  return (
    // o boneco sentado está girado 180°; −3π/4 deixa a placa de frente para a câmera isométrica
    <group visible={visible} position={[-0.5, 0.05, 0]}>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation={[0, (-3 * Math.PI) / 4, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
