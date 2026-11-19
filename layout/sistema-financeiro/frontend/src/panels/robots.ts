// Tabela de robôs do escritório (espelho de backend/app/office/routes.py).
import type { Action } from '../ws/types'

/** Minicontrato: preço em pontos vindo de um PROXY (sem base nem rolagem). */
export interface InstrumentInfo {
  symbol: string
  name: string
  /** Ticker do yfinance usado como proxy (ex.: ^BVSP, USDBRL=X). */
  proxy: string
  scale: number
  /** R$ por ponto por contrato. */
  multiplier: number
}

export interface RobotRow {
  id: string
  name: string
  room: string
  strategy: string
  ticker: string
  interval: '1d' | '1h'
  run_id: string
  initial_cash: number
  equity: number
  pnl: number
  pnl_pct: number
  /** P&L de operações já encerradas (inclui taxas). */
  realized_pnl: number
  /** P&L das posições abertas (marcado no último preço). */
  unrealized_pnl: number
  day_pnl: number
  day_pnl_pct: number
  /** Últimos patrimônios da conta (mini-curva dos monitores). */
  spark: number[]
  /** Ajustes de aparência do operador vindos do office.yaml. */
  look: Record<string, string>
  /** Minicontrato simulado por proxy (WIN/WDO); `null` = ação. */
  instrument: InstrumentInfo | null
  /** Moeda da conta (cripto: USD). */
  currency: 'BRL' | 'USD'
  live: LiveInfo
  /** Rastreador: lista fixa de ativos que ele varre (vazio = robô de um ativo só). */
  universe: string[]
  /** Posições abertas da conta (ativo e quantidade; negativa = vendido). */
  positions: { ticker: string; qty: number }[]
  open_qty: number
  last_signal: Action | null
  last_reason: string | null
  last_decision_ts: string | null
  enabled: boolean
  paused: boolean
}

export type RobotSort = 'pnl' | 'day_pnl' | 'name'

/** Nova lista ordenada (P&L do maior para o menor; nome em ordem alfabética). */
export function sortRobots(rows: readonly RobotRow[], by: RobotSort): RobotRow[] {
  const copy = [...rows]
  if (by === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return copy.sort((a, b) => b[by] - a[by])
}

/** Nomes legíveis das estratégias (código em backend/app/strategies). */
export const STRATEGY_LABEL: Record<string, string> = {
  sma_cross: 'Cruzamento de médias',
  rsi_reversion: 'Reversão RSI',
  donchian: 'Rompimento Donchian',
  atr_trend: 'Tendência ATR',
  bull_flag: 'Bandeira de alta',
  ma20_reclaim: 'Retomada da MM20',
  oversold_bounce: 'Repique sobrevendido',
  mesa_ia: 'Equipe de agentes IA',
}

/** Situação do robô em texto (tabela e painel lateral). */
export function robotStatus(r: RobotRow): string {
  if (!r.enabled) return 'desligado'
  if (r.paused) return 'pausado'
  if (r.universe.length > 0) {
    if (r.open_qty <= 0) return 'aguardando'
    return `${r.open_qty} ativo${r.open_qty === 1 ? '' : 's'} em carteira`
  }
  if (r.instrument) {
    // minicontratos: posição com sinal (negativa = vendido a descoberto)
    const n = Math.abs(r.open_qty)
    const unit = `${n} contrato${n === 1 ? '' : 's'}`
    if (r.open_qty > 0) return `comprado (${unit})`
    if (r.open_qty < 0) return `vendido (${unit})`
    return 'aguardando'
  }
  return r.open_qty > 0 ? `posicionado (${r.open_qty})` : 'aguardando'
}

/**
 * Detalhe do robô só se for do robô selecionado: enquanto o pedido do novo robô
 * não volta, `useApi` ainda devolve o anterior e misturaria contas.
 */
export function detailFor<T extends { id: string }>(data: T | null, selected: string): T | null {
  return data && data.id === selected ? data : null
}

/** Avaliação ao vivo (critério de candidato: 3 meses com a mesma configuração). */
export interface LiveInfo {
  since: string
  days: number
  target_days: number
  remaining_days: number
  /** Retorno da conta desde o início (fração). */
  robot_return: number
  /** Comprar e segurar o mesmo ativo desde o início (minis: 1 contrato); null = sem dados. */
  hold_return: number | null
  beats_hold: boolean | null
}

export function liveLabel(live: LiveInfo): string {
  const since =
    live.days === 0
      ? 'ao vivo desde hoje'
      : `ao vivo há ${live.days} dia${live.days === 1 ? '' : 's'}`
  const rest =
    live.remaining_days > 0
      ? live.remaining_days === 1
        ? 'falta 1 dia para 3 meses'
        : `faltam ${live.remaining_days} dias para 3 meses`
      : '3 meses completos'
  return `${since} · ${rest}`
}

/** Coluna da tabela: "12 de 90 dias" (legível também para leitor de tela). */
export function liveDays(live: LiveInfo): string {
  return `${live.days} de ${live.target_days} dias`
}

/** Coluna "Ativo": o ticker do robô ou, no rastreador, quantos ativos ele varre. */
export function assetLabel(r: Pick<RobotRow, 'ticker' | 'universe'>): string {
  if (r.universe.length > 0) return `rastreador · ${r.universe.length} ativos`
  return r.ticker.replace('.SA', '')
}
