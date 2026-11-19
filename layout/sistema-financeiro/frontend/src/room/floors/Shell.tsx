/**
 * Casca dos andares: piso escuro, paredes com painéis e filetes dourados (bloom),
 * janela com a cidade à noite e placa com o nome do andar. Tudo desenhado em código.
 */
import { useCanvasTexture } from '../canvasTexture'
import { ROOM } from '../layout3d'
import { GoldStrip, Plant } from '../models3d'

export function Shell({
  title,
  subtitle,
  sign,
}: {
  title: string
  subtitle: string
  /** Placa na parede do fundo: centro e tamanho. */
  sign: { x: number; y: number; w: number; h: number }
}) {
  const floorTex = useCanvasTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#1e212a'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#2a2e3a'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, w - 2, h - 2)
    },
    [],
    { repeat: [22, 16] },
  )

  const signTex = useCanvasTexture(
    1024,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#0e1016'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#f2c14e'
      ctx.font = 'bold 92px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(title, w / 2, h * 0.42)
      ctx.fillStyle = '#8a90a6'
      ctx.font = '38px system-ui, sans-serif'
      ctx.fillText(subtitle, w / 2, h * 0.8)
    },
    [title, subtitle],
  )

  // cidade à noite (janelas acesas em posições fixas: sem aleatoriedade entre renders)
  const cityTex = useCanvasTexture(
    512,
    192,
    (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#0b1426')
      sky.addColorStop(1, '#1b2742')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 14; i++) {
        const bw = 24 + ((i * 37) % 30)
        const bh = 60 + ((i * 53) % 110)
        const bx = i * 37
        ctx.fillStyle = '#0a0f1c'
        ctx.fillRect(bx, h - bh, bw, bh)
        ctx.fillStyle = '#f6d48b'
        for (let wy = h - bh + 8; wy < h - 6; wy += 14)
          for (let wx = bx + 4; wx < bx + bw - 4; wx += 9)
            if ((wx * 7 + wy * 3 + i) % 5 === 0) ctx.fillRect(wx, wy, 4, 6)
      }
    },
    [],
  )

  const { minX, maxX, minZ, maxZ, wallH } = ROOM
  const W = maxX - minX
  const D = maxZ - minZ
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTex} roughness={0.55} metalness={0.15} />
      </mesh>
      {/* paredes do fundo */}
      <mesh position={[0, wallH / 2, minZ - 0.1]} receiveShadow>
        <boxGeometry args={[W, wallH, 0.2]} />
        <meshStandardMaterial color="#252833" />
      </mesh>
      <mesh position={[minX - 0.1, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, wallH, D]} />
        <meshStandardMaterial color="#21242e" />
      </mesh>
      {/* filetes dourados: topo das paredes, rodapé e verticais entre os painéis */}
      <GoldStrip position={[0, wallH - 0.08, minZ + 0.02]} size={[W, 0.04, 0.02]} />
      <GoldStrip position={[minX + 0.02, wallH - 0.08, 0]} size={[0.02, 0.04, D]} />
      <GoldStrip position={[0, 0.05, minZ + 0.02]} size={[W, 0.03, 0.02]} intensity={0.6} />
      <GoldStrip position={[minX + 0.02, 0.05, 0]} size={[0.02, 0.03, D]} intensity={0.6} />
      {[-9, -6.5, 9.5].map((x) => (
        <GoldStrip
          key={x}
          position={[x, wallH / 2, minZ + 0.02]}
          size={[0.03, wallH - 0.4, 0.02]}
        />
      ))}
      {/* janela com a cidade à noite na parede lateral */}
      <group position={[minX + 0.02, 1.75, 3.6]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[5, 1.9]} />
          <meshBasicMaterial map={cityTex} toneMapped={false} />
        </mesh>
        {[-1.25, 0, 1.25].map((x) => (
          <mesh key={x} position={[x, 0, 0.01]}>
            <boxGeometry args={[0.05, 1.9, 0.02]} />
            <meshStandardMaterial color="#2a2d38" />
          </mesh>
        ))}
      </group>
      {/* placa do andar */}
      <mesh position={[sign.x, sign.y, minZ + 0.03]}>
        <planeGeometry args={[sign.w, sign.h]} />
        <meshBasicMaterial map={signTex} toneMapped={false} />
      </mesh>
      <GoldStrip
        position={[sign.x, sign.y - sign.h / 2 - 0.04, minZ + 0.03]}
        size={[sign.w, 0.025, 0.02]}
      />
      <Plant x={minX + 0.6} z={minZ + 0.6} scale={1.3} />
      <Plant x={maxX - 0.7} z={minZ + 0.6} scale={1.2} />
      <Plant x={minX + 0.6} z={maxZ - 0.8} />
    </group>
  )
}
