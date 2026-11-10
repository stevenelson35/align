import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createInvestmentList, useInvestmentList, useInvestmentLists, useInvestmentData, saveInvestmentList, saveInvestmentStocks } from '../../firebase/investing'
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
  type InvestmentList,
  priceContext,
  peLabel,
  scannerTime,
} from '../../utils/investing'
import { audienceLabel, audienceOf, parentsOf, privacyFields, type Audience } from '../../utils/audience'
import { safeUrl } from '../../utils/links'
import { investmentLink } from '../../utils/text'
import { TextForm } from '../Tasks/TextAbout'
import { AudiencePicker } from '../UI/AudiencePicker'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { ScannerStatusPanel } from './ScannerStatusPanel'
import { useTodayExpansion } from '../../hooks/useTodaySection'

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
const moveClass = (v?: number | null) => (v === null || v === undefined || v === 0 ? '' : v > 0 ? ' invest-up' : ' invest-down')

export function InvestingSection() {
  const app = useApp()
  const { lists, error } = useInvestmentLists(app.uid, app.member.role)
  const [open, saveOpen] = useStoredFlag(`align-today-invest-${app.uid}`, false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [creating, setCreating] = useState(false)
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  async function create(e: FormEvent) {
    e.preventDefault()
    setCreatingBusy(true)
    try {
      await createInvestmentList(app.uid, name)
      setName('')
      setCreating(false)
      setCreateError(null)
    } catch (e) { setCreateError(String(e)) }
    finally { setCreatingBusy(false) }
  }
  return (
    <div className="day-section">
      <SectionHeader icon="coin" title="Investing" help="investing" onTitleClick={() => setOpen(!open)} expanded={open}>
        {!open && <button type="button" className="link small" onClick={() => setOpen(true)}>Show</button>}
        {app.isMember && <button type="button" className="link small" onClick={() => { setOpen(true); setCreating(!creating) }}>+ New list</button>}
      </SectionHeader>
      {error && <p className="error small">{error}</p>}
      {open && <>
        {creating && <form className="row" onSubmit={create}>
          <input aria-label="New investment list name" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <button type="submit" disabled={creatingBusy}>Create list</button>
          <button type="button" className="secondary" onClick={() => setCreating(false)}>Cancel</button>
        </form>}
        {createError && <p className="error small">{createError}</p>}
        {!lists.length && <p className="muted small">{app.isMember ? 'Opening your investment lists…' : 'No investment lists are shared with you.'}</p>}
        {lists.map((list) => <InvestmentListSection key={`${app.uid}:${list.id}`} list={list} />)}
      </>}
    </div>
  )
}

function InvestmentListEditor({ list, close }: { list: InvestmentList; close: () => void }) {
  const app = useApp()
  const [name, setName] = useState(list.name)
  const [audience, setAudience] = useState<Audience>(audienceOf(list))
  const [chosen, setChosen] = useState(list.sharedWith ?? [])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { sharedWith: _shared, audience: _audience, ...base } = list
      await saveInvestmentList({ ...base, name, ...privacyFields(audience, list.ownerId, chosen, parentsOf(app.household)) })
      close()
    } catch (e) { setError(String(e)); setSaving(false) }
  }
  return <form className="invest-detail" onSubmit={save}>
    <label>Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></label>
    <AudiencePicker label="Who can see this list" value={audience} onChange={setAudience} ownerId={list.ownerId} chosen={chosen} onChosen={setChosen} noun="investment list" />
    <p className="muted small">Only you can edit. Sharing includes every position, quantity, cost and scanner result on this list.</p>
    {error && <p className="error small">{error}</p>}
    <button type="submit" disabled={saving}>Save</button>{' '}
    <button type="button" className="secondary" onClick={close}>Cancel</button>
  </form>
}

export function InvestmentEntryView({ listId, symbol }: { listId: string; symbol: string }) {
  const app = useApp()
  const { list, loaded, error } = useInvestmentList(listId, app.uid)
  if (error) return <p className="error">{error}</p>
  if (!list) return <p className="muted">{loaded ? "That investment list isn't shared with you, or it was deleted." : 'Opening investment…'}</p>
  return <InvestmentListSection key={`${app.uid}:${listId}:${symbol}`} list={list} linkedSymbol={symbol} />
}

function InvestmentListSection({ list, linkedSymbol }: { list: InvestmentList; linkedSymbol?: string }) {
  const app = useApp()
  const { summary, watchlist, error: dataError, loaded } = useInvestmentData(list, app.uid)
  const settings = list
  const owner = app.isMember && list.ownerId === app.uid
  const [storedOpen, setStoredOpen] = useStoredFlag(`align-invest-${app.uid}-${list.id}`, false)
  const [linkOpen, setLinkOpen] = useState(true)
  const open = linkedSymbol ? linkOpen : storedOpen
  const setOpen = linkedSymbol ? setLinkOpen : setStoredOpen
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(linkedSymbol ? `${list.kind === 'holdings' ? 'h' : 'c'}:${linkedSymbol}` : null)
  const symbols = settings ? allSymbols(settings) : []
  const bySymbol = new Map((summary?.holdings ?? []).map((h) => [h.symbol, h]))
  const positions = new Map((settings?.positions ?? []).map((p) => [p.symbol, p]))
  const candidates = watchlist?.candidates ?? []
  const linkedRow = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!linkedSymbol || !loaded) return
    // Let the page shell reset its scroll before positioning the linked stock.
    const frame = requestAnimationFrame(() => linkedRow.current?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [linkedSymbol, loaded, summary, watchlist])
  const linkedMissing = linkedSymbol && loaded && !dataError && !(list.kind === 'holdings' ? symbols.includes(linkedSymbol) : candidates.some((c) => c.symbol === linkedSymbol))
  const textAbout = (symbol: string, name?: string) => <>
    <p className="muted small">The recipient must sign in and have access to this list. Texting a link does not change sharing. The link opens the latest available information, not a saved report.</p>
    <TextForm subject={{ title: `${symbol}${name && name !== symbol ? ` — ${name}` : ''} · ${list.name}`, when: '', link: investmentLink(list.id, symbol) }} startOpen={false} label="Text about this" />
  </>
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  async function add(e: FormEvent) {
    e.preventDefault()
    const typed = parseSymbols(text)
    if (!typed.length) return setError('Type ticker symbols, like AAPL or VOO.')
    setError(null)
    setText('')
    try { await saveInvestmentStocks(list.id, { positions: settings.positions, symbols: [...new Set([...settings.symbols, ...typed])] }) }
    catch (e) { fail(e); setText(typed.join(', ')) }
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = parsePortfolioCsv(await file.text())
      if (!imported.length) throw new Error('No positions found — export the portfolio as a spreadsheet (CSV) with a Symbol column.')
      setError(null)
      await saveInvestmentStocks(list.id, { symbols: settings.symbols, positions: mergePositions(settings.positions, imported) })
      setAdding(false)
    } catch (err) {
      fail(err)
    }
  }

  const remove = async (symbol: string) => {
    try { await saveInvestmentStocks(list.id, {
      symbols: (settings?.symbols ?? []).filter((s) => s !== symbol),
      positions: (settings?.positions ?? []).filter((p) => p.symbol !== symbol),
    }) } catch (e) { fail(e) }
  }

  const holdingRow = (symbol: string) => {
    const h: Holding = bySymbol.get(symbol) ?? { symbol, flags: [] }
    const p = positions.get(symbol)
    const gain = p?.paid && h.price ? ((h.price - p.paid) / p.paid) * 100 : undefined
    const showing = detail === `h:${symbol}`
    const context = priceContext(h)
    return (
      <li key={symbol} className="invest-row" ref={symbol === linkedSymbol ? linkedRow : undefined}>
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
          {owner && <button type="button" className="row-action" onClick={() => remove(symbol)} aria-label={`Stop following ${symbol}`} title="Stop following">
            <Icon name="close" />
          </button>}
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
                52-week closing-price range ${h.low52} – ${h.high52}
              </p>
            )}
            {context && <p className="muted small">{Math.abs(context.belowHigh).toFixed(1)}% {context.belowHigh <= 0 ? 'below' : 'above'} 52-week high
              {context.rangePosition !== undefined && <> · {context.rangePosition.toFixed(0)}% through the 52-week closing-price range</>}. Price context, not intrinsic valuation.</p>}
            <p className="small">Trailing P/E: {peLabel(h.peTrailing)} · Forward P/E: {peLabel(h.peForward)}. Forward earnings are estimates, not guarantees.</p>
            {h.valuationCheckedAt ? <p className="muted small">Yahoo valuation checked {scannerTime(h.valuationCheckedAt)}.</p> : <p className="muted small">{h.error ? 'Valuation was not fetched because this stock refresh failed.' : 'No valuation lookup timestamp in this saved result. Older scanner versions did not fetch holdings P/E; save the updated script and wait for a holdings refresh. A pending candidate scan does not block P/E lookups.'}</p>}
            {h.peerComparison && <p className="small">{h.industry}: forward P/E median {h.peerComparison.medianForwardPe.toFixed(1)}× among {h.peerComparison.count} other stocks in this list; this stock trades at a {Math.abs(h.peerComparison.premiumPct).toFixed(0)}% {h.peerComparison.premiumPct >= 0 ? 'premium' : 'discount'}. Not an industry-wide benchmark.</p>}
            {!h.peerComparison && <p className="muted small">Peer comparison needs at least three other stocks in this list with the same reported industry and positive forward P/E. ETFs and missing data may have no comparison.</p>}
            {h.error && <p className="error small">{h.error}</p>}
            {h.valuationError && <p className="error small">{h.valuationError}</p>}
            {h.news?.length ? (
              <ul className="invest-news">
                {h.news.map((n) => (
                  <li key={n.url}>
                    <a href={safeUrl(n.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="small">
                      {n.title} <Icon name="external" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No headlines yet.</p>
            )}
            {textAbout(symbol, h.name)}
          </div>
        )}
      </li>
    )
  }

  const candidateRow = (c: Candidate) => {
    const showing = detail === `c:${c.symbol}`
    const f = c.facts ?? {}
    return (
      <li key={c.symbol} className="invest-row" ref={c.symbol === linkedSymbol ? linkedRow : undefined}>
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
              {f.peTrailing !== undefined && f.peForward !== undefined && <>P/E {f.peTrailing} → {f.peForward} forward · </>}
              insider buys {f.insiderBuys6m ?? 0} (6 mo)
              {c.recovery !== undefined && c.recovery !== null && <> · AI recovery estimate {c.recovery}% (uncalibrated)</>}
            </p>
            {c.reportStatus === 'generated' && <p className="muted small">AI write-up generated {scannerTime(c.reportGeneratedAt)}.</p>}
            {c.reportStatus === 'failed' && <p className="muted small">AI write-up was attempted {scannerTime(c.reportAttemptedAt)}, but no report was returned. Check the scanner’s Executions logs for Gemini errors. The screening facts above are still available.</p>}
            {c.reportStatus === 'not_configured' && <p className="muted small">AI write-up was not attempted: GEMINI_API_KEY was not configured when this candidate was analyzed. The screening facts above are still available.</p>}
            {c.reportStatus === 'not_attempted' && <p className="muted small">AI write-up was not attempted for this candidate. The screening facts above are still available.</p>}
            {!c.reportStatus && <p className="muted small">{c.report && c.report.trim() !== 'This is an automated research note, not investment advice.' ? 'This report has no recorded generation time or attempt status.' : 'No AI write-up is included, and this result has no recorded report status, so it’s not possible to tell whether generation was attempted.'} Save the updated scanner; its next completed pass will record the outcome.</p>}
            {c.report && <pre className="invest-report">{c.report}</pre>}
            {textAbout(c.symbol, c.name)}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="invest-group">
      <SectionHeader icon={list.kind === 'holdings' ? 'list' : 'search'} title={list.name} count={list.kind === 'holdings' ? symbols.length : candidates.length} onTitleClick={() => setOpen(!open)} expanded={open}>
        {!open && (
          <button type="button" className="link small" onClick={() => setOpen(true)} aria-expanded={false}>
            Show
          </button>
        )}
        {owner && <button type="button" className="link small" onClick={() => setEditing(!editing)}>Edit / sharing</button>}
        {open && owner && list.kind === 'holdings' && (
          <button type="button" className="link small header-add" onClick={() => setAdding(!adding)} aria-expanded={adding} title="Add stocks" aria-label="Add stocks">
            <Icon name="plus" />
          </button>
        )}
      </SectionHeader>
      <p className="muted small">{audienceLabel(audienceOf(list))} · {list.ownerId === app.uid ? 'Your list' : `${app.household.members[list.ownerId]?.displayName ?? 'Another member'}’s list (read only)`}</p>
      {editing && owner && <InvestmentListEditor list={list} close={() => setEditing(false)} />}
      {dataError && <p className="error small">{dataError}</p>}
      {linkedSymbol && !loaded && <p className="muted small">Opening stock information…</p>}
      {linkedMissing && <p className="muted small">{linkedSymbol} is no longer in this list{list.kind === 'overreactions' ? ', or no scanner result has been published yet' : ''}. Links show the latest list, not archived reports.</p>}
      {open && (
        <>
          <ScannerStatusPanel list={list} watchlist={watchlist} />
          {adding && owner && list.kind === 'holdings' && (
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
          {list.kind === 'holdings' && (symbols.length ? (
            <>
              {summary?.day && <p className="muted small">As of {summary.day}. Information to read about, never advice.</p>}
              {summary && <p className="muted small">Holdings refresh: {summary.generatedAt ? scannerTime(summary.generatedAt) : 'timestamp not recorded'} · {summary.holdings.length} stocks · {summary.priceErrors ?? 'unrecorded'} price failures · {summary.valuationIssues ?? 'unrecorded'} valuation issues.</p>}
              {summary?.note && <p className="muted small">{summary.note}</p>}
              <ul className="invest-list">{symbols.map(holdingRow)}</ul>
            </>
          ) : (
            <p className="muted small">
              {owner ? 'Add stocks with + or import a portfolio CSV (E*TRADE: Portfolio → Download).' : 'This list has no stocks yet.'}
            </p>
          ))}
          {list.kind === 'overreactions' && (
            <>
              <h4 className="invest-heading">
                Watchlist: post-earnings overreactions
                {watchlist?.day && <span className="muted small"> scanned {watchlist.day}</span>}
              </h4>
              {candidates.length ? (
                <ul className="invest-list">{candidates.map(candidateRow)}</ul>
              ) : (
                <p className="muted small">{watchlist ? watchlist.note || 'The last pass found nothing that cleared the screen — most don’t.' : 'No completed watchlist yet. See scanner progress above; the first pass can take a day or two.'}</p>
              )}
            </>
          )}
          {error && <p className="error small">{error}</p>}
        </>
      )}
    </div>
  )
}
