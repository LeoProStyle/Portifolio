import { api } from '../api/client'
import { useApi } from '../lib/useApi'
import { useRoomStore } from '../store/useRoomStore'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function signed(v: number): string {
  return `${v >= 0 ? '+' : ''}${brl.format(v)}`
}

/** Carteira SIMULADA (PaperBroker). Nenhum valor aqui é dinheiro real. */
export function Portfolio() {
  const cyclesFinished = useRoomStore((s) => s.cyclesFinished)
  const live = useRoomStore((s) => s.portfolio)
  const lastCycleCost = useRoomStore((s) => s.lastCycleCost)
  const { data, error, loading } = useApi((signal) => api.portfolio(signal), `${cyclesFinished}`)

  // o evento ao vivo é mais novo que a resposta REST do mesmo ciclo
  const pf = live ?? data
  const initial = pf?.initial_cash ?? data?.initial_cash ?? 100_000
  const totalPnl = pf ? pf.equity - initial : 0
  const pending = data?.pending_orders ?? []

  return (
    <section className="panel portfolio" aria-label="Carteira simulada">
      <header>
        <h2>Carteira simulada · Mesa IA</h2>
        {lastCycleCost !== null && (
          <span className="hint">custo do último ciclo: US$ {lastCycleCost.toFixed(4)}</span>
        )}
      </header>
      {loading && !pf && <p className="hint">Carregando carteira…</p>}
      {error && <p className="error">Erro: {error}</p>}
      {pf && (
        <>
          <dl className="kpis">
            <div>
              <dt>Patrimônio</dt>
              <dd>{brl.format(pf.equity)}</dd>
            </div>
            <div>
              <dt>Caixa</dt>
              <dd>{brl.format(pf.cash)}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd className={totalPnl >= 0 ? 'up' : 'down'}>
                {signed(totalPnl)} ({((totalPnl / initial) * 100).toFixed(2)}%)
              </dd>
            </div>
            {data && (
              <div>
                <dt>Hoje</dt>
                <dd className={data.daily_pnl_pct >= 0 ? 'up' : 'down'}>
                  {(data.daily_pnl_pct * 100).toFixed(2)}%
                </dd>
              </div>
            )}
          </dl>

          {pf.positions.length === 0 ? (
            <p className="hint">Sem posições abertas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Ativo</th>
                  <th scope="col">Qtd</th>
                  <th scope="col">PM</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Stop</th>
                  <th scope="col">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {pf.positions.map((p) => (
                  <tr key={p.ticker}>
                    <th scope="row">{p.ticker}</th>
                    <td className="num">{p.qty}</td>
                    <td className="num">{p.avg_price.toFixed(2)}</td>
                    <td className="num">{p.mark?.toFixed(2) ?? '—'}</td>
                    <td className="num">{p.stop?.toFixed(2) ?? '—'}</td>
                    <td className={`num ${(p.pnl ?? 0) >= 0 ? 'up' : 'down'}`}>
                      {p.pnl !== null && p.pnl !== undefined ? signed(p.pnl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pending.length > 0 && (
            <>
              <h3>Ordens aguardando o próximo candle</h3>
              <ul className="pending">
                {pending.map((o) => (
                  <li key={o.id}>
                    {o.side} {o.qty} {o.ticker}
                    {o.stop ? ` · stop ${o.stop.toFixed(2)}` : ''}
                    <span className="meta">
                      {' '}
                      · criada {o.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="hint">
                Executam na abertura do próximo candle diário (nunca no preço que gerou o sinal).
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
