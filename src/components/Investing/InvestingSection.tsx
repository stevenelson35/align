import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useInvesting, saveInvesting } from '../../firebase/investing'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import {
  allSymbols,
  FLAG_LABELS,
  mergePositions,
  parsePortfolioCsv,
  parseSymbols,
  type Candidate,
  type Holding,
} from '../../utils/investing'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
const moveClass = (v?: number | null) => (v === null || v === undefined || v === 0 ? '' : v > 0 ? ' invest-up' : ' invest-down')

/**
 * Investing on Today (in More… to start; DESIGN.md §5.13): your own stocks — type symbols or import an E*TRADE
 * portfolio CSV — with today's prices, moves and headlines (big moves flagged), and the market scanner's watchlist
 * of post-earnings overreactions, each with its score and one-page note. Everything here is yours alone; the data
 * comes from scripts/market-scanner (runs every few hours). Research help, never advice.
 */
export function InvestingSection() {
  const app = useApp()
  const { settings, summary, watchlist } = useInvesting(app.uid)
  const [open, setOpen] = useStoredFlag('align-today-invest', false)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null) // an open holding (news) or candidate (report)
  if (!app.isMember) return null
  const symbols = settings ? allSymbols(settings) : []
  const bySymbol = new Map((summary?.holdings ?? []).map((h) => [h.symbol, h]))
  const positions = new Map((settings?.positions ?? []).map((p) => [p.symbol, p]))
  const candidates = watchlist?.candidates ?? []
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  async function add(e: FormEvent) {
    e.preventDefault()
    const typed = parseSymbols(text)
    if (!typed.length) return setError('Type ticker symbols, like AAPL or VOO.')
    setError(null)
    setText('')
    await saveInvesting(app.uid, { symbols: [...new Set([...(settings?.symbols ?? []), ...typed])] }).catch(fail)
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = parsePortfolioCsv(await file.text())
      if (!imported.length) throw new Error('No positions found — export the portfolio as a spreadsheet (CSV) with a Symbol column.')
      setError(null)
      await saveInvesting(app.uid, { positions: mergePositions(settings?.positions ?? [], imported) })
      setAdding(false)
    } catch (err) {
      fail(err)
    }
  }

  const remove = (symbol: string) =>
    saveInvesting(app.uid, {
      symbols: (settings?.symbols ?? []).filter((s) => s !== symbol),
      positions: (settings?.positions ?? []).filter((p) => p.symbol !== symbol),
    }).catch(fail)

  const holdingRow = (symbol: string) => {
    const h: Holding = bySymbol.get(symbol) ?? { symbol, flags: [] }
    const p = positions.get(symbol)
    const gain = p?.paid && h.price ? ((h.price - p.paid) / p.paid) * 100 : undefined
    const showing = detail === `h:${symbol}`
    return (
      <li key={symbol} className="invest-row">
        <div className="collection-row">
          <button
            type="button"
            className="collection-row-main"
            onClick={() => setDetail(showing ? null : `h:${symbol}`)}
            aria-expanded={showing}
            title={h.name && h.name !== symbol ? h.name : 'Details'}
          >
            <span className="invest-symbol">{symbol}</span>
            <span className="muted small">{h.price !== undefined ? `$${h.price}` : 'waiting for the scanner'}</span>
            <span className={`small${moveClass(h.change1d)}`}>{pct(h.change1d)}</span>
            <span className={`small muted${moveClass(h.change5d)}`}>{pct(h.change5d)} wk</span>
            <span className="grow" />
            {h.flags.map((f) => (
              <span key={f} className={`badge ${f.includes('Drop') || f.includes('drop') || f === 'near52wLow' ? 'danger' : 'calendar'}`}>
                {FLAG_LABELS[f] ?? f}
              </span>
            ))}
          </button>
          <button type="button" className="row-action" onClick={() => remove(symbol)} aria-label={`Stop following ${symbol}`} title="Stop following">
            <Icon name="close" />
          </button>
        </div>
        {showing && (
          <div className="invest-detail">
            {p && (
              <p className="small">
                {p.qty} shares{p.paid !== undefined && <> at ${p.paid} — <span className={moveClass(gain)}>{pct(gain)}</span> since</>}
              </p>
            )}
            {h.low52 !== undefined && h.high52 !== undefined && (
              <p className="muted small">
                52-week range ${h.low52} – ${h.high52}
              </p>
            )}
            {h.news?.length ? (
              <ul className="invest-news">
                {h.news.map((n) => (
                  <li key={n.url}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="small">
                      {n.title} <Icon name="external" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No headlines yet.</p>
            )}
          </div>
        )}
      </li>
    )
  }

  const candidateRow = (c: Candidate) => {
    const showing = detail === `c:${c.symbol}`
    const f = c.facts ?? {}
    return (
      <li key={c.symbol} className="invest-row">
        <div className="collection-row">
          <button type="button" className="collection-row-main" onClick={() => setDetail(showing ? null : `c:${c.symbol}`)} aria-expanded={showing} title={c.name}>
            <span className="badge tokens">{c.score}</span>
            <span className="invest-symbol">{c.symbol}</span>
            <span className="grow small muted">{c.name}</span>
            <span className="small invest-down">{pct(c.drop5d)} in 5 days</span>
          </button>
        </div>
        {showing && (
          <div className="invest-detail">
            <p className="muted small">
              {f.revenueGrowth !== undefined && <>revenue {pct(f.revenueGrowth)} · </>}
              {f.fcfMargin !== undefined && <>FCF margin {f.fcfMargin}% · </>}
              {f.netDebtToEbitda !== undefined && <>net debt/EBITDA {f.netDebtToEbitda} · </>}
              {f.pe !== undefined && f.peAvg10y !== undefined && <>P/E {f.pe} vs {f.peAvg10y} (10-yr avg) · </>}
              insider buys {f.insiderBuys90d ?? 0}
              {c.recovery !== undefined && c.recovery !== null && <> · recovery estimate {c.recovery}%</>}
            </p>
            {c.report ? <pre className="invest-report">{c.report}</pre> : <p className="muted small">No write-up (add a Gemini key to the scanner for one-page notes).</p>}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="day-section">
      <SectionHeader icon="coin" title="Investing" count={symbols.length || undefined} help="investing" onTitleClick={() => setOpen(!open)} expanded={open}>
        {!open && (
          <button type="button" className="link small" onClick={() => setOpen(true)} aria-expanded={false}>
            Show
          </button>
        )}
        {open && (
          <button type="button" className="link small header-add" onClick={() => setAdding(!adding)} aria-expanded={adding} title="Add stocks" aria-label="Add stocks">
            <Icon name="plus" />
          </button>
        )}
      </SectionHeader>
      {open && (
        <>
          {adding && (
            <form className="row add-task" onSubmit={add}>
              <input autoFocus placeholder="Symbols to follow, like AAPL, VOO…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} />
              <button type="submit" className="secondary small">
                Add
              </button>
              <label className="link small invest-import">
                Import CSV
                <input type="file" accept=".csv,text/csv" onChange={importCsv} />
              </label>
            </form>
          )}
          {symbols.length ? (
            <>
              {summary?.day && <p className="muted small">As of {summary.day}. Information to read about, never advice.</p>}
              <ul className="invest-list">{symbols.map(holdingRow)}</ul>
            </>
          ) : (
            <p className="muted small">
              Follow your stocks here: + adds symbols, or imports a portfolio CSV (E*TRADE: Portfolio → Download). The market scanner (scripts/market-scanner) fills in prices, news and the watchlist below a few times a day.
            </p>
          )}
          {symbols.length > 0 && (
            <>
              <h4 className="invest-heading">
                Watchlist: post-earnings overreactions
                {watchlist?.day && <span className="muted small"> scanned {watchlist.day}</span>}
              </h4>
              {candidates.length ? (
                <ul className="invest-list">{candidates.map(candidateRow)}</ul>
              ) : (
                <p className="muted small">{watchlist ? watchlist.note || 'The last pass found nothing that cleared the screen — most don’t.' : 'The market scanner hasn’t reported yet (scripts/market-scanner/README.md sets it up).'}</p>
              )}
            </>
          )}
          {error && <p className="error small">{error}</p>}
        </>
      )}
    </div>
  )
}
