/**
 * Câmera isométrica com zoom e arrastar (com limites) e brilho (bloom) dos filetes dourados.
 * Usa só módulos que já vêm no Three.js (examples/jsm): nenhuma dependência nova.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { clampTarget } from '../office/deskLayout'

/** Direção fixa da câmera isométrica (a partir do alvo). */
const ISO_OFFSET = new THREE.Vector3(15, 14, 15)

export interface CameraFrame {
  /** Ponto do piso que fica no centro da tela. */
  target: [number, number, number]
  /** Largura e altura (em metros) que precisam caber na tela. */
  span: [number, number]
}

/** Enquadra a câmera no alvo e define os limites de zoom (×0,7 a ×2,5 do inicial). */
function frameCamera(
  camera: THREE.OrthographicCamera,
  controls: OrbitControls,
  target: [number, number, number],
  base: number,
): void {
  controls.minZoom = base * 0.7
  controls.maxZoom = base * 2.5
  controls.target.set(...target)
  camera.position.set(...target).add(ISO_OFFSET)
  camera.zoom = base
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
}

/** Puxa o alvo (e a câmera junto) de volta para dentro do piso. */
function keepOnFloor(camera: THREE.Camera, controls: OrbitControls): void {
  const [x, z] = clampTarget(controls.target.x, controls.target.z)
  const dx = x - controls.target.x
  const dz = z - controls.target.z
  if (dx === 0 && dz === 0) return
  controls.target.x += dx
  controls.target.z += dz
  camera.position.x += dx
  camera.position.z += dz
}

function setDamping(controls: OrbitControls, on: boolean): void {
  controls.enableDamping = on
}

function connectControls(controls: OrbitControls, el: HTMLElement): void {
  controls.connect(el)
}

/** Monta o pós-processamento; devolve a função que libera tudo (passes incluídos). */
function buildComposer(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  strength: number,
): { composer: EffectComposer; dispose: () => void } {
  const composer = new EffectComposer(gl)
  const passes = [
    new RenderPass(scene, camera),
    new UnrealBloomPass(new THREE.Vector2(256, 256), strength, 0.45, 1.0),
    new OutputPass(),
  ]
  for (const p of passes) composer.addPass(p)
  return {
    composer,
    dispose: () => {
      for (const p of passes) p.dispose()
      composer.dispose()
    },
  }
}

/**
 * Câmera ortográfica fixa em ângulo isométrico. Arrastar move pelo piso (sem girar),
 * a roda/pinça dá zoom entre ×0,7 e ×2,5 do enquadramento inicial. Trocar de andar
 * (`frame`) volta ao enquadramento inicial.
 */
export function CameraRig({
  frame,
  reducedMotion,
}: {
  frame: CameraFrame
  reducedMotion: boolean
}) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const gl = useThree((s) => s.gl)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  // criado SEM elemento DOM: no StrictMode o React chama o useMemo duas vezes, e uma
  // instância conectada e descartada continuaria mexendo na câmera sem limites
  const controls = useMemo(() => {
    const c = new OrbitControls(camera)
    c.enableRotate = false
    c.screenSpacePanning = false // arrasta no plano do piso
    c.zoomToCursor = true
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
    return c
  }, [camera])

  // conecta ao canvas só enquanto montado (desmontar/remontar do StrictMode reconecta)
  useEffect(() => {
    connectControls(controls, gl.domElement)
    return () => controls.disconnect()
  }, [controls, gl])

  useEffect(() => setDamping(controls, !reducedMotion), [controls, reducedMotion])

  // enquadramento inicial (e a cada troca de andar ou de tamanho)
  const [tx, ty, tz] = frame.target
  const [sw, sh] = frame.span
  useEffect(() => {
    frameCamera(camera, controls, [tx, ty, tz], Math.min(width / sw, height / sh))
  }, [camera, controls, width, height, tx, ty, tz, sw, sh])

  // limite do arrastar: o alvo não sai do piso
  useEffect(() => {
    const onChange = () => keepOnFloor(camera, controls)
    controls.addEventListener('change', onChange)
    return () => controls.removeEventListener('change', onChange)
  }, [camera, controls])

  useFrame(() => {
    if (controls.enableDamping) controls.update()
  })
  return null
}

/**
 * Bloom: só o que passa de 1 em luminância brilha (filetes dourados com cor HDR).
 * Assume a renderização (prioridade 1 no useFrame).
 */
export function Bloom({ strength = 0.55 }: { strength?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  // criado no efeito (não no useMemo) para o StrictMode não deixar compositores órfãos
  const composer = useRef<EffectComposer | null>(null)
  useEffect(() => {
    const built = buildComposer(gl, scene, camera, strength)
    composer.current = built.composer
    return () => {
      composer.current = null
      built.dispose()
    }
  }, [gl, scene, camera, strength])

  useEffect(() => {
    composer.current?.setPixelRatio(gl.getPixelRatio())
    composer.current?.setSize(width, height)
  }, [gl, scene, camera, strength, width, height])

  useFrame(() => {
    if (composer.current) composer.current.render()
    else gl.render(scene, camera)
  }, 1)
  return null
}
