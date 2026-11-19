/**
 * Regras de apresentação do escritório (funções puras, testadas).
 * Tudo o que aparece no HUD, nas placas e no 3D sai daqui, a partir dos dados da API.
 */
import type { BuildingResponse, Currency, RoomSummary } from '../api/client'
import type { RobotRow } from '../panels/robots'
import type { Look } from '../room/look'

export type FloorId = 'diretoria' | 'acoes' | 'minis' | 'cripto'

export interface Floor {
  id: FloorId
  label: string
  /** Sala do backend (`office.yaml`) mostrada neste andar; `null` na Diretoria. */
  room: string | null
  /** Andar planejado (Etapas 5/6), ainda sem robôs. */
  soon: boolean
}

export const FLOORS: readonly Floor[] = [
  { id: 'diretoria', label: 'Diretoria', room: null, soon: false },
  { id: 'acoes', label: 'Ações B3', room: 'acoes', soon: false },
  { id: 'minis', label: 'Minicontratos', room: 'minis', soon: false },
  { id: 'cripto', label: 'Cripto', room: 'cripto', soon: false },
]

export function floorRoom(floor: Floor, rooms: readonly RoomSummary[]): RoomSummary | null {
  if (!floor.room || floor.soon) return null
  return rooms.find((r) => r.id === floor.room) ?? null
}

/** Fechados = realizado (operações encerradas); Abertos = posições abertas; Ambos = total. */
export type PnlView = 'fechados' | 'abertos' | 'ambos'

export function pnlOf(row: RobotRow, view: PnlView): number {
  if (view === 'fechados') return row.realized_pnl
  if (view === 'abertos') return row.unrealized_pnl
  return row.realized_pnl + row.unrealized_pnl
}

export function sumPnl(rows: readonly RobotRow[], view: PnlView): number {
  return rows.reduce((acc, r) => acc + pnlOf(r, view), 0)
}

export type Tone = 'up' | 'down' | 'flat'

/** Centavo arredondado: abaixo de meio centavo conta como zero. */
function cents(v: number): number {
  return Math.round(v * 100) / 100
}

export function tone(v: number): Tone {
  const c = cents(v)
  return c > 0 ? 'up' : c < 0 ? 'down' : 'flat'
}

const FORMATS: Record<Currency, Intl.NumberFormat> = {
  BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  USD: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }),
}

/** Valor sem sinal na moeda da sala (R$ ou US$). */
export function money(v: number, currency: Currency = 'BRL'): string {
  return FORMATS[currency].format(v)
}

export function signedMoney(v: number, currency: Currency = 'BRL'): string {
  const c = cents(v)
  return `${c < 0 ? '-' : '+'}${FORMATS[currency].format(Math.abs(c))}`
}

export function signedBrl(v: number): string {
  return signedMoney(v, 'BRL')
}

/** Resultado do prédio em reais: cada sala convertida pela sua cotação (sem cotação = fora). */
export function sumPnlBrl(
  robots: Record<string, readonly RobotRow[]>,
  rooms: readonly RoomSummary[],
  view: PnlView,
): number {
  return rooms.reduce((acc, room) => {
    if (room.fx_rate === null) return acc
    return acc + sumPnl(activeRows(robots[room.id] ?? []), view) * room.fx_rate
  }, 0)
}

export function ranking(rows: readonly RobotRow[], view: PnlView, n = 5): RobotRow[] {
  return [...rows].sort((a, b) => pnlOf(b, view) - pnlOf(a, view)).slice(0, n)
}

/** Fala do Gerente Geral: só fatos do prédio (sem LLM, sem opinião sobre o mercado). */
export function managerLine(b: BuildingResponse): string {
  if (b.paused) return `Prédio pausado: ${b.reason ?? 'sem motivo'}. Sem compras novas hoje.`
  const paused = b.rooms.find((r) => r.paused)
  if (paused)
    return `Sala ${paused.name} pausada: ${paused.reason ?? 'sem motivo'}. Stops seguem valendo.`
  const fx = b.fx_missing ? ' Sem cotação do dólar agora: a sala em dólar ficou fora do total.' : ''
  return `Prédio hoje ${signedBrl(b.day_pnl)} · nenhum limite atingido.${fx}`
}

const HAIR = ['#2b1d14', '#5a3a22', '#1b1b1b', '#a0522d', '#d9b26f', '#7a7a7a']
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#f6d7b0']
const SHIRT = ['#4caf50', '#42a5f5', '#ef6c57', '#ab47bc', '#26a69a', '#ffca28', '#8d6e63']
const PANTS = ['#37474f', '#263238', '#3e4a6b', '#4e342e']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Operador = pessoa simples, roupa casual; estável por robô. O YAML (`look`) pode ajustar. */
export function operatorLook(id: string, override: Record<string, string> = {}): Look {
  const h = hash(id)
  const pick = <T>(list: readonly T[], shift: number): T => list[(h >>> shift) % list.length]
  const shirt = override.shirt ?? pick(SHIRT, 0)
  return {
    hair: override.hair ?? pick(HAIR, 5),
    skin: override.skin ?? pick(SKIN, 10),
    shirt,
    detail: override.detail ?? shirt,
    pants: override.pants ?? pick(PANTS, 15),
  }
}

/** Mini-curva em [0,1] (0 = mínimo, 1 = máximo). Sem dados ou constante → linha no meio. */
export function normalizeSpark(values: readonly number[]): number[] {
  if (values.length < 2) return [0.5, 0.5]
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max - min < 1e-9) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

/** Robôs que contam no prédio: o backend soma só os ligados (`enabled`) no patrimônio e nas curvas. */
export function activeRows(rows: readonly RobotRow[]): RobotRow[] {
  return rows.filter((r) => r.enabled)
}

/** Capital inicial somado dos robôs ligados (base do telão da sala). */
export function initialCash(rows: readonly RobotRow[]): number {
  return activeRows(rows).reduce((acc, r) => acc + r.initial_cash, 0)
}
