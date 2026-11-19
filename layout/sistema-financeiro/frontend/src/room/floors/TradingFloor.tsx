/**
 * Andar de robôs (Ações B3 ou Minicontratos): uma mesa por robô de regras (operador,
 * 2 monitores e placa de P&L) e o telão com a curva de patrimônio da sala. Em Ações fica a
 * ilha da Mesa IA; em Minicontratos, o painel com os proxies declarados. Tudo vem da API.
 */
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { robotDesks, MAX_DESKS } from '../../office/deskLayout'
import { initialCash, operatorLook, tone } from '../../office/office'
import { openRobot, useOfficeStore } from '../../office/useOfficeStore'
import type { RobotRow } from '../../panels/robots'
import { CharacterBrain } from '../brain'
import { useCanvasTexture } from '../canvasTexture'
import type { RoomFx } from '../fx'
import type { LabelRegistry } from '../labelRegistry'
import { Anchor } from '../labels3d'
import { BIG_SCREEN, ISLAND, ROOM_SIGN, seatOf, type Spot } from '../layout3d'
import { Chair, Desk, Person, ScreenMonitor } from '../models3d'
import {
  CRYPTO_NOTES,
  drawEquityScreen,
  drawProxyBoard,
  drawRobotInfo,
  drawSpark,
  PROXY_NOTES,
} from '../screens'
import { AgentIsland, AgentIslandLabels, MESA_IA, RobotPlate } from './AgentIsland'
import { GOLD } from '../gold'
import { Shell } from './Shell'

const EMPTY: RobotRow[] = []

/** Placa da parede de cada andar. */
const ROOM_META: Record<string, { title: string; subtitle: string }> = {
  acoes: { title: 'AÇÕES B3', subtitle: 'escritório de pregão · simulação' },
  minis: { title: 'MINICONTRATOS', subtitle: 'WIN e WDO por proxy · simulação' },
  cripto: { title: 'CRIPTOMOEDAS', subtitle: '24 horas · contas em US$ · simulação' },
}

function useRuleRobots(roomId: string): RobotRow[] {
  const rows = useOfficeStore((s) => s.robots[roomId]) ?? EMPTY
  return useMemo(
    () => rows.filter((r) => r.id !== MESA_IA && r.strategy !== 'mesa_ia').slice(0, MAX_DESKS),
    [rows],
  )
}

function setCursor(on: boolean): void {
  document.body.style.cursor = on ? 'pointer' : ''
}

function RobotDesk({
  row,
  spot,
  registry,
  reducedMotion,
}: {
  row: RobotRow
  spot: Spot
  registry: LabelRegistry
  reducedMotion: boolean
}) {
  const selected = useOfficeStore((s) => s.selectedRobot === row.id)
  const brain = useMemo(() => new CharacterBrain(seatOf(spot), Infinity), [spot])
  const active = row.enabled && !row.paused
  useEffect(() => {
    // robô pausado/desligado: operador para de digitar
    if (active) brain.work()
    else brain.rest()
  }, [brain, active])

  const lookKey = JSON.stringify(row.look)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => operatorLook(row.id, row.look), [row.id, lookKey])
  const t = tone(row.pnl)
  const spark = useCanvasTexture(256, 148, (ctx, w, h) => drawSpark(ctx, w, h, row.spark, t), [
    row.spark.join(','),
    t,
  ])
  const info = useCanvasTexture(
    256,
    148,
    (ctx, w, h) =>
      drawRobotInfo(ctx, w, h, {
        name: row.name,
        ticker: row.ticker,
        signal: row.last_signal,
        paused: !active,
      }),
    [row.name, row.ticker, row.last_signal, active],
  )

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    if (e.delta < 6) openRobot(row) // arrastar a câmera não conta como clique
  }

  return (
    <group
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setCursor(true)
      }}
      onPointerOut={() => setCursor(false)}
    >
      <Desk x={spot.x} z={spot.z} w={1.9} />
      <ScreenMonitor x={spot.x - 0.42} z={spot.z - 0.16} map={spark} turn={0.18} />
      <ScreenMonitor x={spot.x + 0.42} z={spot.z - 0.16} map={info} turn={-0.18} />
      <Chair x={spot.x} z={spot.z + 0.85} />
      <Person look={look} brain={brain} workStyle="type" reducedMotion={reducedMotion}>
        <Anchor registry={registry} id={`robot:${row.id}`} />
      </Person>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[spot.x, 0.015, spot.z + 0.35]}>
          <ringGeometry args={[1.2, 1.28, 48]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function RoomScreen({ roomId, title }: { roomId: string; title: string }) {
  const curve = useOfficeStore((s) => s.curves[roomId])
  const rows = useOfficeStore((s) => s.robots[roomId]) ?? EMPTY
  const initial = initialCash(rows) // mesma base da curva: só robôs ligados
  const points = curve ?? []
  const tex = useCanvasTexture(
    1024,
    384,
    (ctx, w, h) => drawEquityScreen(ctx, w, h, title, points, initial, rows[0]?.currency ?? 'BRL'),
    [points.length, points[points.length - 1]?.value, initial, rows[0]?.currency],
  )
  const { x, y, z, w, h } = BIG_SCREEN
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

/** Minicontratos: painel em pé declarando os PROXIES (limitação mostrada na própria sala). */
function ProxyBoard({ roomId }: { roomId: string }) {
  const rows = useOfficeStore((s) => s.robots[roomId]) ?? EMPTY
  const lines = [
    ...new Map(
      rows.filter((r) => r.instrument).map((r) => [r.instrument!.symbol, r.instrument!]),
    ).values(),
  ].map((i) => `${i.symbol} ≈ ${i.proxy}${i.scale !== 1 ? ` × ${i.scale}` : ''}`)
  // cripto: o painel lista os ativos em US$ e a limitação do preço agregado
  const crypto = roomId === 'cripto'
  // rastreador entra com a lista que ele varre (não com o rótulo VARREDURA)
  const shown = crypto
    ? [...new Set(rows.flatMap((r) => (r.universe.length > 0 ? r.universe : [r.ticker])))]
    : lines
  const tex = useCanvasTexture(
    512,
    512,
    (ctx, w, h) =>
      drawProxyBoard(
        ctx,
        w,
        h,
        shown,
        crypto ? 'ATIVOS (US$)' : 'PROXIES',
        crypto ? CRYPTO_NOTES : PROXY_NOTES,
      ),
    [shown.join('|'), crypto],
  )
  return (
    <group position={[ISLAND.x, 0, ISLAND.z]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[2.7, 2.7, 0.12]} />
        <meshStandardMaterial color="#0c0d12" />
      </mesh>
      <mesh position={[0, 1.35, 0.065]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[2.9, 0.04, 0.6]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Cena 3D de um andar de robôs (dentro do Canvas). Ações tem a ilha da Mesa IA. */
export function TradingFloor({
  roomId,
  fx,
  registry,
  reducedMotion,
}: {
  roomId: string
  fx: RoomFx
  registry: LabelRegistry
  reducedMotion: boolean
}) {
  const robots = useRuleRobots(roomId)
  const desks = useMemo(() => robotDesks(robots.length), [robots.length])
  const meta = ROOM_META[roomId] ?? { title: roomId.toUpperCase(), subtitle: 'simulação' }
  return (
    <group>
      <Shell title={meta.title} subtitle={meta.subtitle} sign={ROOM_SIGN} />
      {roomId === 'acoes' ? (
        <AgentIsland fx={fx} registry={registry} reducedMotion={reducedMotion} />
      ) : (
        <ProxyBoard roomId={roomId} />
      )}
      {robots.map((r, i) => (
        <RobotDesk
          key={r.id}
          row={r}
          spot={desks[i]}
          registry={registry}
          reducedMotion={reducedMotion}
        />
      ))}
      <RoomScreen roomId={roomId} title={`${meta.title} · patrimônio da sala (simulado)`} />
    </group>
  )
}

/** Etiquetas HTML do andar (fora do Canvas). */
export function TradingFloorLabels({
  roomId,
  fx,
  registry,
}: {
  roomId: string
  fx: RoomFx
  registry: LabelRegistry
}) {
  const robots = useRuleRobots(roomId)
  return (
    <>
      {roomId === 'acoes' && <AgentIslandLabels fx={fx} registry={registry} />}
      {robots.map((r) => (
        <RobotPlate key={r.id} row={r} registry={registry} />
      ))}
    </>
  )
}
