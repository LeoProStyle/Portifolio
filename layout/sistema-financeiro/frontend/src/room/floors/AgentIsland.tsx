/**
 * Ilha da Mesa IA no andar de Ações: os 4 agentes (Notícias, Gráfico, Risco, Gestor),
 * o terminal de ordens e a placa PARE, dirigidos pelos eventos ao vivo (director + brain).
 */
import { useFrame } from '@react-three/fiber'
import { Fragment, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from 'zustand'
import { pnlOf, signedMoney, tone } from '../../office/office'
import { openRobot, useOfficeStore } from '../../office/useOfficeStore'
import type { RobotRow } from '../../panels/robots'
import { ROOM_AGENTS, type RoomAgent } from '../director'
import type { RoomFx } from '../fx'
import type { LabelRegistry } from '../labelRegistry'
import { Anchor } from '../labels3d'
import { AGENT_DESKS, AGENT_LABELS, ISLAND, seatOf, TERMINAL } from '../layout3d'
import type { Look } from '../look'
import { Chair, Desk, GoldStrip, Monitor, Person, StopSign } from '../models3d'

const LOOKS: Record<RoomAgent, Look> = {
  news: { hair: '#5a3a22', skin: '#f1c27d', shirt: '#4caf50', detail: '#2e7d32', pants: '#37474f' },
  chart: {
    hair: '#1b1b1b',
    skin: '#c68642',
    shirt: '#42a5f5',
    detail: '#1565c0',
    pants: '#263238',
  },
  risk: { hair: '#bdbdbd', skin: '#e0ac69', shirt: '#ef5350', detail: '#8e1b1b', pants: '#3e2723' },
  manager: {
    hair: '#3b2a1a',
    skin: '#8d5524',
    shirt: '#f5f5f5',
    detail: '#7e57c2',
    pants: '#212121',
  },
}

const MONITORS: Record<RoomAgent, string[]> = {
  news: ['#e8e8e8'],
  chart: ['#1f7a4a', '#8a2a2a', '#1f7a4a'],
  risk: ['#b8860b', '#455a64'],
  manager: ['#5e48a8'],
}

/** Id do robô da equipe de agentes no office.yaml. */
export const MESA_IA = 'mesa-ia'

function AgentDesk({ agent }: { agent: RoomAgent }) {
  const d = AGENT_DESKS[agent]
  const seat = seatOf(d)
  const screens = MONITORS[agent]
  return (
    <group>
      <Desk x={d.x} z={d.z} />
      {screens.map((color, i) => (
        <Monitor
          key={i}
          x={d.x + (i - (screens.length - 1) / 2) * 0.58}
          z={d.z - 0.18}
          color={color}
        />
      ))}
      {agent === 'news' && (
        <mesh position={[d.x + 0.55, 0.78, d.z + 0.1]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.4, 0.01, 0.3]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      )}
      {agent === 'risk' && (
        <group position={[d.x + 0.6, 0.77, d.z + 0.05]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.02, 0.04, 0.36, 6]} />
            <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[0.44, 0.02, 0.02]} />
            <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      )}
      {agent === 'manager' && (
        <group position={[d.x + 0.55, 0.78, d.z + 0.08]}>
          <mesh>
            <boxGeometry args={[0.36, 0.02, 0.26]} />
            <meshStandardMaterial color="#9aa3b5" />
          </mesh>
          <mesh position={[0, 0.12, -0.12]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.36, 0.24, 0.015]} />
            <meshStandardMaterial color="#263238" emissive="#3f51b5" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
      <Chair x={seat.x} z={seat.y} />
    </group>
  )
}

function RiskSign({ fx }: { fx: RoomFx }) {
  const veto = useStore(fx.store, (s) => s.veto)
  return <StopSign visible={veto !== null} />
}

function Terminal({ fx, registry }: { fx: RoomFx; registry: LabelRegistry }) {
  const screen = useRef<THREE.MeshStandardMaterial>(null)
  const idle = useMemo(() => new THREE.Color('#2f6f8f'), [])
  const buy = useMemo(() => new THREE.Color('#2ecc71'), [])
  const sell = useMemo(() => new THREE.Color('#e74c3c'), [])
  useFrame((state) => {
    const m = screen.current
    if (!m) return
    const flash = fx.store.getState().flash
    const active = flash && fx.now() < flash.until
    const blink = active && Math.floor(state.clock.elapsedTime * 7) % 2 === 0
    const color = blink ? (flash.side === 'COMPRA' ? buy : sell) : idle
    m.color.copy(color)
    m.emissive.copy(color)
  })
  return (
    <group position={[TERMINAL.x, 0, TERMINAL.z]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.9, 1.2, 0.45]} />
        <meshStandardMaterial color="#1f222c" />
      </mesh>
      <GoldStrip position={[0, 1.18, 0.23]} size={[0.9, 0.02, 0.01]} intensity={0.8} />
      <mesh position={[0, 1.42, 0.05]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.06]} />
        <meshStandardMaterial color="#14161d" />
      </mesh>
      <mesh position={[0, 1.42, 0.085]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial
          ref={screen}
          color="#2f6f8f"
          emissive="#2f6f8f"
          emissiveIntensity={0.9}
        />
      </mesh>
      <Anchor registry={registry} id="terminal" y={2.0} />
    </group>
  )
}

/** Cena 3D da ilha (dentro do Canvas). */
export function AgentIsland({
  fx,
  registry,
  reducedMotion,
}: {
  fx: RoomFx
  registry: LabelRegistry
  reducedMotion: boolean
}) {
  const row = useOfficeStore((s) => s.robots.acoes?.find((r) => r.id === MESA_IA))
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        if (row && e.delta < 6) openRobot(row)
      }}
    >
      {/* tapete da ilha com borda dourada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ISLAND.x, 0.005, ISLAND.z]} receiveShadow>
        <planeGeometry args={[7, 7.4]} />
        <meshStandardMaterial color="#1d1a2b" roughness={1} />
      </mesh>
      <GoldStrip
        position={[ISLAND.x, 0.012, ISLAND.z + 3.7]}
        size={[7, 0.01, 0.03]}
        intensity={0.5}
      />
      <GoldStrip
        position={[ISLAND.x + 3.5, 0.012, ISLAND.z]}
        size={[0.03, 0.01, 7.4]}
        intensity={0.5}
      />
      {ROOM_AGENTS.map((agent) => (
        <group key={agent}>
          <AgentDesk agent={agent} />
          <Person
            look={LOOKS[agent]}
            brain={fx.brains[agent]}
            workStyle={agent === 'news' ? 'read' : 'type'}
            reducedMotion={reducedMotion}
          >
            <Anchor registry={registry} id={`agent:${agent}`} />
            {agent === 'risk' && <RiskSign fx={fx} />}
          </Person>
        </group>
      ))}
      <group position={[ISLAND.x, 0.6, ISLAND.z]}>
        <Anchor registry={registry} id={`robot:${MESA_IA}`} />
      </group>
      <Terminal fx={fx} registry={registry} />
    </group>
  )
}

/** Placa nome + P&L de um robô (HTML por cima do canvas; clique abre o painel). */
export function RobotPlate({ row, registry }: { row: RobotRow; registry: LabelRegistry }) {
  const view = useOfficeStore((s) => s.pnlView)
  const selected = useOfficeStore((s) => s.selectedRobot === row.id)
  const v = pnlOf(row, view)
  return (
    <div ref={registry.follow(`robot:${row.id}`)} className="lbl lbl-click">
      <button
        type="button"
        tabIndex={-1}
        className={`tag-pnl tag-plate ${tone(v)} ${selected ? 'selected' : ''}`}
        onClick={() => openRobot(row)}
      >
        <b>{row.name}</b>
        {signedMoney(v, row.currency)}
      </button>
    </div>
  )
}

/** Etiquetas HTML da ilha (fora do Canvas). */
export function AgentIslandLabels({ fx, registry }: { fx: RoomFx; registry: LabelRegistry }) {
  const bubbles = useStore(fx.store, (s) => s.bubbles)
  const alerts = useStore(fx.store, (s) => s.alerts)
  const row = useOfficeStore((s) => s.robots.acoes?.find((r) => r.id === MESA_IA))
  return (
    <>
      {ROOM_AGENTS.map((agent) => {
        const anchor = `agent:${agent}`
        const bubble = bubbles[agent]
        const alertUntil = alerts[agent]
        return (
          <Fragment key={agent}>
            <div ref={registry.follow(anchor)} className="lbl">
              <span className="tag-name">{AGENT_LABELS[agent]}</span>
            </div>
            {bubble && (
              <div
                ref={registry.follow(anchor)}
                className="lbl lbl-bubble"
                data-until={bubble.until}
              >
                <div className="tag-bubble">{bubble.text}</div>
              </div>
            )}
            {alertUntil && (
              <div ref={registry.follow(anchor)} className="lbl lbl-alert" data-until={alertUntil}>
                <span className="tag-alert">!</span>
              </div>
            )}
          </Fragment>
        )
      })}
      <div ref={registry.follow('terminal')} className="lbl">
        <span className="tag-name">Terminal de ordens</span>
      </div>
      {row && <RobotPlate row={row} registry={registry} />}
    </>
  )
}
