import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { api, type Currency, type EquityPoint } from '../api/client'
import { useApi } from '../lib/useApi'
import { money, signedMoney, tone } from '../office/office'
import { useRefreshOffice } from '../office/useOfficeData'
import { selectedRow, useOfficeStore } from '../office/useOfficeStore'
import { useRoomStore } from '../store/useRoomStore'
import { assetLabel, detailFor, liveLabel, robotStatus, STRATEGY_LABEL } from './robots'

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Fração → "+1,23%" (pt-BR, com sinal). */
function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2).replace('.', ',')}%`
}

const REASON = { decisao: 'decisão', stop: 'stop', alvo: 'alvo' } as const
const STATUS = { pending: ' · pendente', rejected: ' · rejeitada', filled: '' } as const

/** Curva de patrimônio da conta do robô (lightweight-charts, linha). */
function EquityChart({ points, currency }: { points: EquityPoint[]; currency: Currency }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!el.current) return
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#14161f' }, textColor: '#d8dbe6' },
      grid: { vertLines: { visible: false }, horzLines: { color: '#262a3a' } },
      rightPriceScale: { borderColor: '#2e3344' },
      timeScale: { borderColor: '#2e3344' },
      localization: { locale: 'pt-BR', priceFormatter: (v: number) => money(v, currency) },
    })
    series.current = c.addSeries(LineSeries, { color: '#f2c14e', lineWidth: 2 })
    chart.current = c
    return () => {
      c.remove()
      chart.current = null
      series.current = null
    }
  }, [currency])

  useEffect(() => {
    series.current?.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
    chart.current?.timeScale().fitContent()
  }, [points])

  return <div ref={el} className="robot-chart" aria-hidden="true" />
}

/** Painel lateral do robô clicado (na cena 3D ou na tabela). */
export function RobotDetail() {
  const row = useOfficeStore(selectedRow)
  const selected = useOfficeStore((s) => s.selectedRobot)
  const select = useOfficeStore((s) => s.select)
  const robotTick = useRoomStore((s) => s.robotTick)
  const refresh = useRefreshOffice()
  const [actionError, setActionError] = useState<string | null>(null)
  const detail = useApi(
    (signal) => (selected ? api.robot(selected, signal) : Promise.resolve(null)),
    `${selected ?? ''}|${robotTick}`,
  )

  if (!selected) {
    return (
      <aside className="panel robot-detail empty" aria-label="Painel do robô">
        <p className="hint">
          Clique numa mesa da sala (ou em “Ver” na tabela) para abrir o painel do robô: conta
          simulada, curva de patrimônio, ordens e último sinal.
        </p>
      </aside>
    )
  }
  if (!row) {
    return (
      <aside className="panel robot-detail" aria-label="Painel do robô">
        <p className="hint">Robô “{selected}” não encontrado neste escritório.</p>
        <button type="button" onClick={() => select(null)}>
          Fechar
        </button>
      </aside>
    )
  }

  const current = row
  async function togglePause() {
    setActionError(null)
    try {
      await api.setPaused('robots', current.id, !current.paused)
      refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  const data = detailFor(detail.data, current.id)
  const orders = data?.orders ?? []
  const stats: [string, number][] = [
    ['Total', row.pnl],
    ['Fechados', row.realized_pnl],
    ['Abertos', row.unrealized_pnl],
    ['Hoje', row.day_pnl],
  ]

  return (
    <aside className="panel robot-detail" aria-label={`Painel do robô ${row.name}`}>
      <header>
        <h2>{row.name}</h2>
        <button type="button" onClick={() => select(null)} aria-label="Fechar painel do robô">
          ✕
        </button>
      </header>
      <p className="hint">
        {STRATEGY_LABEL[row.strategy] ?? row.strategy} · {assetLabel(row)} · candle {row.interval} ·{' '}
        {robotStatus(row)}
      </p>
      <dl className="robot-stats">
        <div>
          <dt>Patrimônio</dt>
          <dd>{money(row.equity, row.currency)}</dd>
        </div>
        {stats.map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={tone(v)}>{signedMoney(v, row.currency)}</dd>
          </div>
        ))}
      </dl>
      <p className="robot-signal">
        Último sinal: <strong>{row.last_signal ?? '—'}</strong>
        {row.last_reason && <small className="reason">{row.last_reason}</small>}
      </p>
      {row.universe.length > 0 && (
        <p className="hint" role="note">
          Rastreador: todo dia aplica a estratégia em {row.universe.length} ativos de uma lista fixa
          ({row.universe.map((t) => t.replace('.SA', '')).join(', ')}) e abre os de sinal mais
          forte, com o mesmo risco dos outros robôs.{' '}
          {row.positions.length > 0
            ? `Em carteira: ${row.positions.map((p) => `${p.ticker.replace('.SA', '')} (${p.qty})`).join(', ')}.`
            : 'Nenhum ativo em carteira agora.'}{' '}
          Comparação: cesta igual dos ativos da lista.
        </p>
      )}
      {row.instrument && (
        <p className="hint proxy-note" role="note">
          {row.instrument.name}: preço em pontos vindo de <strong>{row.instrument.proxy}</strong>
          {row.instrument.scale !== 1 && ` × ${row.instrument.scale}`}, R${' '}
          {row.instrument.multiplier.toFixed(2).replace('.', ',')} por ponto por contrato. Sem base
          (futuro × à vista) e sem rolagem de vencimento; custos e margem são estimativas. Compra e
          venda a descoberto permitidas (simulação).
        </p>
      )}
      {row.strategy === 'mesa_ia' && (
        <p className="hint">
          A Mesa IA é a equipe de agentes (Notícias, Gráfico, Risco, Gestor): o raciocínio completo
          de cada ciclo está na linha do tempo abaixo.
        </p>
      )}

      <h3>Avaliação ao vivo (dados reais, conta simulada)</h3>
      <p className="hint">{liveLabel(row.live)}</p>
      <dl className="robot-stats">
        <div>
          <dt>Robô desde o início</dt>
          <dd className={tone(row.live.robot_return)}>{pct(row.live.robot_return)}</dd>
        </div>
        <div>
          <dt>
            {row.universe.length > 0
              ? 'Cesta igual da lista'
              : row.instrument
                ? 'Comprar e segurar 1 contrato'
                : 'Comprar e segurar o ativo'}
          </dt>
          <dd className={row.live.hold_return === null ? '' : tone(row.live.hold_return)}>
            {row.live.hold_return !== null
              ? pct(row.live.hold_return)
              : row.strategy === 'mesa_ia'
                ? 'não se aplica'
                : 'ainda sem dados'}
          </dd>
        </div>
      </dl>
      <p className="hint" role="note">
        {row.live.beats_hold === null
          ? row.strategy === 'mesa_ia'
            ? 'A Mesa IA opera vários ativos: não há um único ativo para comparar.'
            : 'Comparação começa com o primeiro candle depois do início da conta.'
          : row.live.beats_hold
            ? 'Até agora o robô está à frente de comprar e segurar (depois dos custos).'
            : 'Até agora o robô está atrás de comprar e segurar.'}{' '}
        Candidato só depois de 3 meses ao vivo e batendo o comprar e segurar; mesmo assim não é
        recomendação nem garantia de resultado.
      </p>

      <h3>Curva de patrimônio (conta simulada)</h3>
      {detail.error && <p className="error">Erro ao carregar o robô: {detail.error}</p>}
      {data && data.equity_curve.length > 0 ? (
        <EquityChart points={data.equity_curve} currency={row.currency} />
      ) : (
        <p className="hint">{data ? 'Ainda sem histórico.' : 'Carregando…'}</p>
      )}

      <h3>Últimas ordens</h3>
      {orders.length === 0 ? (
        <p className="hint">Nenhuma ordem ainda.</p>
      ) : (
        <ul className="robot-orders">
          {orders.slice(0, 8).map((o) => (
            <li key={o.id} className={o.side === 'COMPRA' ? 'up' : 'down'}>
              {o.side} {o.filled_qty ?? o.qty} {o.ticker.replace('.SA', '')}
              {o.fill_price !== null && ` @ ${money(o.fill_price, row.currency)}`} ·{' '}
              {REASON[o.reason]}
              {STATUS[o.status]}
              <small>{dateFmt.format(new Date(o.filled_at ?? o.created_at))}</small>
            </li>
          ))}
        </ul>
      )}

      <div className="controls">
        <button type="button" onClick={() => void togglePause()}>
          {row.paused ? 'Retomar robô' : 'Pausar compras do robô'}
        </button>
      </div>
      {actionError && <p className="error">Erro: {actionError}</p>}
    </aside>
  )
}
