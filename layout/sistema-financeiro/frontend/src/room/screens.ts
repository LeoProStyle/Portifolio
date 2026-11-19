/**
 * Desenhos das telas da cena (monitores e telões) em <canvas>.
 * Só desenham dados recebidos da API; nenhum número é inventado aqui.
 */
import type { EquityPoint } from '../api/client'
import type { Currency } from '../api/client'
import { money, normalizeSpark, signedBrl, signedMoney, type Tone } from '../office/office'

const TONE_COLOR: Record<Tone, string> = { up: '#5ec27a', down: '#e2645a', flat: '#8a90a6' }
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const FONT = 'system-ui, sans-serif'

function toneOf(v: number): Tone {
  return v > 0.005 ? 'up' : v < -0.005 ? 'down' : 'flat'
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#111827')
  bg.addColorStop(1, '#0a0e17')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
}

/** Linha (e área) de uma série já normalizada em [0,1] dentro do retângulo dado. */
function plotLine(
  ctx: CanvasRenderingContext2D,
  norm: number[],
  box: { x: number; y: number; w: number; h: number },
  color: string,
  width: number,
): void {
  const px = (i: number) => box.x + (i / (norm.length - 1)) * box.w
  const py = (v: number) => box.y + box.h - v * box.h
  const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h)
  grad.addColorStop(0, `${color}55`)
  grad.addColorStop(1, `${color}00`)
  ctx.beginPath()
  norm.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))))
  ctx.lineTo(px(norm.length - 1), box.y + box.h)
  ctx.lineTo(px(0), box.y + box.h)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.beginPath()
  norm.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))))
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

/** Monitor da mesa: mini-curva do patrimônio da conta do robô. */
export function drawSpark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  values: readonly number[],
  tone: Tone,
): void {
  background(ctx, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  for (let gy = h / 4; gy < h; gy += h / 4) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(w, gy)
    ctx.stroke()
  }
  plotLine(ctx, normalizeSpark(values), { x: 8, y: 14, w: w - 16, h: h - 28 }, TONE_COLOR[tone], 4)
}

/** Monitor da mesa: nome, ativo e último sinal do robô (texto). */
export function drawRobotInfo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  info: { name: string; ticker: string; signal: string | null; paused: boolean },
): void {
  background(ctx, w, h)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f2c14e'
  ctx.font = `bold 34px ${FONT}`
  ctx.fillText(info.name, 14, 12)
  ctx.fillStyle = '#c9cfdc'
  ctx.font = `26px ${FONT}`
  ctx.fillText(info.ticker.replace('.SA', ''), 14, 56)
  const signal = info.paused ? 'PAUSADO' : (info.signal ?? '—')
  ctx.fillStyle =
    signal === 'COMPRA'
      ? '#5ec27a'
      : signal === 'VENDA'
        ? '#e2645a'
        : info.paused
          ? '#e0a83a'
          : '#8a90a6'
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText(signal, 14, h - 56)
}

/** Telão da sala: curva de patrimônio somada dos robôs. */
export function drawEquityScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  points: readonly EquityPoint[],
  initial: number,
  currency: Currency = 'BRL',
): void {
  background(ctx, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 2
  for (let gy = 150; gy < h; gy += 60) {
    ctx.beginPath()
    ctx.moveTo(32, gy)
    ctx.lineTo(w - 32, gy)
    ctx.stroke()
  }
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#c9cfdc'
  ctx.font = `32px ${FONT}`
  ctx.fillText(title, 32, 22)
  if (points.length === 0) {
    ctx.fillStyle = '#8a90a6'
    ctx.fillText('aguardando o primeiro registro de patrimônio…', 32, 150)
    return
  }
  const last = points[points.length - 1].value
  const pnl = last - initial
  const t = toneOf(pnl)
  ctx.fillStyle = '#f4f6fb'
  ctx.font = `bold 64px ${FONT}`
  ctx.fillText(money(last, currency), 32, 62)
  ctx.textAlign = 'right'
  ctx.fillStyle = TONE_COLOR[t]
  ctx.font = `bold 44px ${FONT}`
  ctx.fillText(signedMoney(pnl, currency), w - 32, 74)
  ctx.textAlign = 'left'
  // a curva começa no capital inicial: mostra de onde a sala saiu
  const values = [initial, ...points.map((p) => p.value)]
  plotLine(ctx, normalizeSpark(values), { x: 32, y: 160, w: w - 64, h: h - 210 }, TONE_COLOR[t], 6)
  ctx.fillStyle = '#8a90a6'
  ctx.font = `24px ${FONT}`
  ctx.fillText('simulação · contas dos robôs somadas', 32, h - 36)
}

export interface BoardFloor {
  label: string
  /** `null` = andar ainda não existe ("em breve"). */
  equity: number | null
  dayPnl: number | null
}

export interface BoardRank {
  name: string
  pnl: number
}

/** Telão da Diretoria: patrimônio por andar e ranking dos robôs. */
export function drawFloorBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  floors: readonly BoardFloor[],
  rank: readonly BoardRank[],
  viewLabel: string,
): void {
  background(ctx, w, h)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f2c14e'
  ctx.font = `bold 38px ${FONT}`
  ctx.fillText('ANDARES', 40, 28)
  ctx.fillText(`RANKING · ${viewLabel}`, w / 2 + 30, 28)

  floors.forEach((f, i) => {
    const y = 96 + i * 96
    ctx.fillStyle = '#c9cfdc'
    ctx.font = `30px ${FONT}`
    ctx.fillText(f.label, 40, y)
    if (f.equity === null) {
      ctx.fillStyle = '#5d6578'
      ctx.fillText('em breve', 40, y + 38)
      return
    }
    ctx.fillStyle = '#f4f6fb'
    ctx.font = `bold 34px ${FONT}`
    ctx.fillText(brl.format(f.equity), 40, y + 36)
    if (f.dayPnl !== null) {
      ctx.fillStyle = TONE_COLOR[toneOf(f.dayPnl)]
      ctx.textAlign = 'right'
      ctx.font = `28px ${FONT}`
      ctx.fillText(`hoje ${signedBrl(f.dayPnl)}`, w / 2 - 24, y + 40)
      ctx.textAlign = 'left'
    }
  })

  ctx.strokeStyle = 'rgba(242,193,78,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w / 2, 30)
  ctx.lineTo(w / 2, h - 30)
  ctx.stroke()

  if (rank.length === 0) {
    ctx.fillStyle = '#8a90a6'
    ctx.font = `30px ${FONT}`
    ctx.fillText('sem robôs ainda', w / 2 + 30, 110)
  }
  rank.forEach((r, i) => {
    const y = 100 + i * 62
    ctx.fillStyle = '#c9cfdc'
    ctx.font = `bold 32px ${FONT}`
    ctx.fillText(`${i + 1}. ${r.name}`, w / 2 + 30, y)
    ctx.fillStyle = TONE_COLOR[toneOf(r.pnl)]
    ctx.textAlign = 'right'
    ctx.fillText(signedBrl(r.pnl), w - 40, y)
    ctx.textAlign = 'left'
  })
}

export const PROXY_NOTES = [
  'Sem fonte gratuita do contrato real:',
  'preço do índice / do dólar à vista.',
  'Sem base e sem rolagem de vencimento.',
  'Simulação educacional.',
]

export const CRYPTO_NOTES = [
  'Preço agregado do yfinance,',
  'não de uma corretora específica.',
  'Conta em US$; prédio em R$ pela cotação.',
  'Simulação educacional.',
]

/** Painel dos minicontratos: quais proxies alimentam cada contrato e a limitação. */
export function drawProxyBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: readonly string[],
  title = 'PROXIES',
  notes: readonly string[] = PROXY_NOTES,
): void {
  background(ctx, w, h)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f2c14e'
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText(title, 32, 28)
  ctx.fillStyle = '#f4f6fb'
  ctx.font = `bold 34px ${FONT}`
  ;(lines.length ? lines : ['carregando…']).forEach((line, i) =>
    ctx.fillText(line, 32, 100 + i * 52),
  )
  ctx.fillStyle = '#e0a83a'
  ctx.font = `26px ${FONT}`
  notes.forEach((n, i) => ctx.fillText(n, 32, h - 190 + i * 40))
}
