/**
 * Escritório de pregão em 3D isométrico (Three.js + React Three Fiber).
 * Teatro dos dados: cada placa, monitor e telão vem da API; tudo também está em texto
 * (tabela de robôs e linha do tempo).
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useOfficeStore } from '../office/useOfficeStore'
import { useRoomStore } from '../store/useRoomStore'
import { directorActions } from './director'
import { Bloom, CameraRig, type CameraFrame } from './effects'
import { Boardroom, BoardroomLabels } from './floors/Boardroom'
import { TradingFloor, TradingFloorLabels } from './floors/TradingFloor'
import { createRoomFx, type RoomFx } from './fx'
import { LabelRegistry } from './labelRegistry'
import { LabelProjector } from './labels3d'

type Scene = 'acoes' | 'minis' | 'cripto' | 'diretoria'

/** Enquadramento inicial de cada andar (alvo no piso e área que precisa caber). */
const FRAMES: Record<Scene, CameraFrame> = {
  acoes: { target: [0.5, 0.8, -2.0], span: [16.5, 10.5] },
  minis: { target: [0.5, 0.8, -2.0], span: [16.5, 10.5] },
  cripto: { target: [0.5, 0.8, -2.0], span: [16.5, 10.5] },
  diretoria: { target: [0.8, 1.7, -3.4], span: [12, 8.6] },
}

function Lights({ fx }: { fx: RoomFx }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  useFrame((_, delta) => {
    // ciclo da Mesa IA rodando: a sala clareia um pouco
    const on = fx.store.getState().lights
    const k = Math.min(1, delta * 3)
    if (ambient.current)
      ambient.current.intensity += ((on ? 1.25 : 1.0) - ambient.current.intensity) * k
    if (sun.current) sun.current.intensity += ((on ? 2.0 : 1.6) - sun.current.intensity) * k
  })
  return (
    <>
      <ambientLight ref={ambient} intensity={1.0} />
      <hemisphereLight args={['#c9d6ff', '#2a2010', 0.6]} />
      <directionalLight
        ref={sun}
        position={[8, 14, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />
      {/* luz quente vinda dos filetes dourados da parede do fundo */}
      <pointLight
        position={[0, 2.6, -6.5]}
        color="#ffb648"
        intensity={6}
        distance={14}
        decay={1.6}
      />
    </>
  )
}

/** Eventos ao vivo da Mesa IA → ações da ilha (director/brain, sem mudança de lógica). */
function useLiveEvents(fx: RoomFx) {
  useEffect(() => {
    const state = useRoomStore.getState()
    fx.apply({ kind: 'lights', on: state.activeCycle !== null })
    if (state.veto) fx.apply({ kind: 'veto', reason: state.veto })
    if (import.meta.env.DEV) (window as unknown as { __room?: RoomFx }).__room = fx
    return useRoomStore.subscribe((s, prev) => {
      if (s.lastLive && s.lastLive !== prev.lastLive) {
        for (const action of directorActions(s.lastLive)) fx.apply(action)
      }
    })
  }, [fx])
}

export default function Room3D({ reducedMotion }: { reducedMotion: boolean }) {
  const fx = useMemo(() => createRoomFx({ reducedMotion }), [reducedMotion])
  const registry = useMemo(() => new LabelRegistry(), [])
  const floor = useOfficeStore((s) => s.floor)
  const scene: Scene = floor
  useLiveEvents(fx)

  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        orthographic
        dpr={[1, 2]}
        camera={{ position: [15, 14, 15], zoom: 40, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        aria-hidden="true"
        className="room-canvas"
        onPointerMissed={() => {
          document.body.style.cursor = ''
        }}
      >
        <color attach="background" args={['#0b0d12']} />
        <CameraRig frame={FRAMES[scene]} reducedMotion={reducedMotion} />
        <Lights fx={fx} />
        {scene !== 'diretoria' ? (
          <TradingFloor
            key={scene}
            roomId={scene}
            fx={fx}
            registry={registry}
            reducedMotion={reducedMotion}
          />
        ) : (
          <Boardroom registry={registry} reducedMotion={reducedMotion} />
        )}
        <LabelProjector registry={registry} now={fx.now} />
        <Bloom />
      </Canvas>
      <div className="room-labels" aria-hidden="true">
        {scene !== 'diretoria' ? (
          <TradingFloorLabels key={scene} roomId={scene} fx={fx} registry={registry} />
        ) : (
          <BoardroomLabels registry={registry} />
        )}
      </div>
    </>
  )
}
