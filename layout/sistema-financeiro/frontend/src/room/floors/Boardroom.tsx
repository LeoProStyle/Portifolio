/**
 * Diretoria: o CEO (o dono) na mesa, o Gerente Geral (o risco do escritório) ao lado
 * e um telão com o patrimônio de cada andar e o ranking dos robôs.
 * O Gerente Geral só "fala" fatos do prédio (managerLine), sem LLM e sem marca.
 */
import { useMemo } from 'react'
import { FLOORS, floorRoom, managerLine, pnlOf } from '../../office/office'
import { allRobots, useOfficeStore } from '../../office/useOfficeStore'
import { CharacterBrain } from '../brain'
import { useCanvasTexture } from '../canvasTexture'
import type { LabelRegistry } from '../labelRegistry'
import { Anchor } from '../labels3d'
import { BOARD_SCREEN, CEO_DESK, CEO_SEAT, GG_SPOT } from '../layout3d'
import type { Look } from '../look'
import { Chair, Desk, GoldStrip, Monitor, Person, Plant } from '../models3d'
import { drawFloorBoard } from '../screens'
import { GOLD } from '../gold'
import { Shell } from './Shell'

/** CEO: careca, de terno, óculos de grau com lente CLARA (aparência escolhida pelo dono). */
const CEO_LOOK: Look = {
  hair: null,
  skin: '#e8b98a',
  shirt: '#f4f6fb',
  detail: '#7a1f2b',
  suit: '#1f2a44',
  pants: '#1f2a44',
  glasses: true,
}

/** Gerente Geral: pessoa padrão de terno (sem logo ou marca). */
const GG_LOOK: Look = {
  hair: '#3b2a1a',
  skin: '#c68642',
  shirt: '#e8ecf2',
  detail: '#b8860b',
  suit: '#3a3f4b',
  pants: '#2c3039',
}

const VIEW_LABEL = { fechados: 'FECHADOS', abertos: 'ABERTOS', ambos: 'TOTAL' } as const

function Board() {
  const building = useOfficeStore((s) => s.building)
  const robots = useOfficeStore((s) => s.robots)
  const view = useOfficeStore((s) => s.pnlView)
  const floors = FLOORS.filter((f) => f.room !== null).map((f) => {
    const room = building ? floorRoom(f, building.rooms) : null
    // sempre em reais (sala em dólar convertida pela cotação do instante)
    return { label: f.label, equity: room?.equity_brl ?? null, dayPnl: room?.day_pnl_brl ?? null }
  })
  const rate = (roomId: string) => building?.rooms.find((x) => x.id === roomId)?.fx_rate ?? null
  const inBrl = allRobots({ robots })
    .filter((r) => rate(r.room) !== null)
    .map((r) => ({ name: r.name, pnl: pnlOf(r, view) * (rate(r.room) ?? 0) }))
  const rank = [...inBrl].sort((a, b) => b.pnl - a.pnl).slice(0, 6)
  const key = JSON.stringify([floors, rank, view])
  const tex = useCanvasTexture(
    1024,
    352,
    (ctx, w, h) => drawFloorBoard(ctx, w, h, floors, rank, VIEW_LABEL[view]),
    [key],
  )
  const { x, y, z, w, h } = BOARD_SCREEN
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[w + 0.2, h + 0.2, 0.06]} />
        <meshStandardMaterial color="#0c0d12" />
      </mesh>
      <mesh position={[0, -h / 2 - 0.13, 0.01]}>
        <boxGeometry args={[w + 0.2, 0.03, 0.03]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function MeetingTable() {
  const x = 5.2
  const z = 0.2
  return (
    <group>
      <mesh position={[x, 0.74, z]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.06, 1.4]} />
        <meshStandardMaterial color="#15171e" roughness={0.3} metalness={0.25} />
      </mesh>
      <GoldStrip position={[x, 0.715, z + 0.705]} size={[3.2, 0.015, 0.01]} intensity={0.7} />
      <mesh position={[x, 0.37, z]}>
        <boxGeometry args={[0.3, 0.74, 0.3]} />
        <meshStandardMaterial color="#1c1f28" />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <group key={i}>
          <Chair x={x + i * 1} z={z - 1.05} turn={Math.PI} />
          <Chair x={x + i * 1} z={z + 1.05} />
        </group>
      ))}
    </group>
  )
}

/** Cena 3D da Diretoria (dentro do Canvas). */
export function Boardroom({
  registry,
  reducedMotion,
}: {
  registry: LabelRegistry
  reducedMotion: boolean
}) {
  const ceo = useMemo(() => new CharacterBrain(CEO_SEAT, Infinity), [])
  const gg = useMemo(() => new CharacterBrain(GG_SPOT, Infinity), [])
  return (
    <group>
      <Shell
        title="DIRETORIA"
        subtitle="CEO · Gerente Geral"
        sign={{ x: -6.6, y: 2.45, w: 2.9, h: 0.72 }}
      />
      {/* tapete da diretoria */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, 0.005, -2.6]} receiveShadow>
        <planeGeometry args={[6.4, 5]} />
        <meshStandardMaterial color="#231d14" roughness={1} />
      </mesh>
      <GoldStrip position={[-0.2, 0.012, -0.1]} size={[6.4, 0.01, 0.03]} intensity={0.5} />
      {/* mesa do CEO de frente para a câmera; o CEO senta atrás dela */}
      <group position={[CEO_DESK.x, 0, CEO_DESK.z]} rotation={[0, Math.PI, 0]}>
        <Desk x={0} z={0} w={2.6} />
        <Monitor x={-0.55} z={-0.18} color="#1f7a4a" />
        <Monitor x={0.55} z={-0.18} color="#5e48a8" />
      </group>
      <GoldStrip
        position={[CEO_DESK.x, 0.715, CEO_DESK.z + 0.401]}
        size={[2.6, 0.015, 0.01]}
        intensity={0.9}
      />
      <Chair x={CEO_SEAT.x} z={CEO_SEAT.y} turn={Math.PI} />
      <Person look={CEO_LOOK} brain={ceo} workStyle="type" reducedMotion={reducedMotion} facing={0}>
        <Anchor registry={registry} id="ceo" />
      </Person>
      <Person
        look={GG_LOOK}
        brain={gg}
        workStyle="type"
        reducedMotion={reducedMotion}
        pose="stand"
        facing={-0.5}
      >
        <Anchor registry={registry} id="gg" />
      </Person>
      <MeetingTable />
      <Plant x={-3.8} z={-5.6} scale={1.2} />
      <Plant x={2.8} z={-5.6} scale={1.2} />
      <Board />
    </group>
  )
}

/** Etiquetas HTML da Diretoria (fora do Canvas). */
export function BoardroomLabels({ registry }: { registry: LabelRegistry }) {
  const building = useOfficeStore((s) => s.building)
  return (
    <>
      <div ref={registry.follow('ceo')} className="lbl">
        <span className="tag-role">CEO</span>
      </div>
      <div ref={registry.follow('gg')} className="lbl">
        <span className="tag-role">Gerente Geral</span>
      </div>
      {building && (
        <div ref={registry.follow('gg')} className="lbl lbl-bubble">
          <div className="tag-bubble">{managerLine(building)}</div>
        </div>
      )}
    </>
  )
}
