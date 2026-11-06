import { useEffect, useState } from 'react'
import { useInvestmentStatus } from '../../firebase/investing'
import { useApp } from '../../hooks/useApp'
import { scannerProgress, scannerStale, scannerTime, type InvestmentList, type Watchlist } from '../../utils/investing'

const STAGES = {
  refreshing: 'Refreshing investment summaries',
  building: 'Building the stock universe',
  screening: 'Checking price drops and trading volume',
  analyzing: 'Checking fundamentals and generating candidate reports',
  completed: 'Full pass completed; waiting for the next slice',
}

export function ScannerStatusPanel({ list, watchlist }: { list: InvestmentList; watchlist: Watchlist | null }) {
  const { uid } = useApp()
  const { status, error, loaded } = useInvestmentStatus(list, uid)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  if (error) return <p className="error small">Scanner status unavailable: {error}</p>
  if (!status) return <div className="invest-detail small">
    <strong>Scanner status</strong>
    <p className="muted">{loaded ? 'Progress has not been reported yet. Save the updated scanner, then run scanStatus or wait for its next trigger. This does not reset the scan.' : 'Loading scanner status…'}</p>
    {watchlist && <p>Last published pass: {scannerTime(watchlist.scannedAt ?? watchlist.day)} · {watchlist.scanned ?? 'unknown'} stocks checked · {watchlist.candidates.length} candidates shown.</p>}
  </div>
  const progress = scannerProgress(status)
  const stale = scannerStale(status, now)
  const run = status.lastRun
  const work = run?.work
  const last = status.lastPass
  return <div className="invest-detail small">
    <strong>Scanner: {STAGES[status.stage]}</strong>
    <p>{stale ? 'Activity not confirmed' : status.execution === 'running' ? 'Slice running' : status.execution === 'error' || run?.error ? 'Last slice failed' : status.execution === 'snapshot' ? 'Saved progress snapshot' : 'Between scheduled slices'} · reported {scannerTime(status.updatedAt)}</p>
    {progress && <>
      <label>{progress.label}: {progress.percent}% ({progress.done.toLocaleString()} / {progress.total.toLocaleString()} attempted)
        <progress aria-label={progress.label} value={progress.done} max={progress.total} style={{ display: 'block', width: '100%' }} />
      </label>
      <p className="muted">{status.stage === 'building' ? 'Universe sizing only' : 'Price screening only'} — not overall completion. Results publish after analysis finishes.</p>
    </>}
    {!progress && <p className="muted">Waiting for the ticker directory; no reliable percentage yet.</p>}
    <p>{status.queued} candidates waiting for analysis · {status.qualified} qualified so far.</p>
    {last ? <p>Last full pass: {scannerTime(last.completedAt)} · {last.screened.toLocaleString()} price checks · {last.qualified} qualified · {last.kept} kept.
    </p> : <p>Last published watchlist: {status.lastWatchlistAt ? scannerTime(status.lastWatchlistAt) : watchlist ? scannerTime(watchlist.scannedAt ?? watchlist.day) : 'not yet — first pass is still pending'}.</p>}
    <details>
      <summary>Last slice and data quality</summary>
      {run ? <p>Last slice started {scannerTime(run.startedAt)}{run.finishedAt && <> · finished {scannerTime(run.finishedAt)}</>}.</p> : <p className="muted">Last-slice history was not recorded by the earlier scanner version.</p>}
      {work && <p>Work in that slice: {work.screened} price checks ({work.priceErrors} failed), {work.analyzed} candidate analyses ({work.analysisErrors} failed), {work.qualified} qualified.</p>}
      {status.stats && <p className="muted">Since tracking began {scannerTime(status.stats.since)}: {status.stats.analyzed} candidate analyses, {status.stats.priceErrors} price failures, {status.stats.analysisErrors} analysis failures.</p>}
      {last?.stats && <p className="muted">Last pass tracked failures: {last.stats.priceErrors} price, {last.stats.analysisErrors} analysis (counts since {scannerTime(last.stats.since)}).</p>}
      <p className="muted">Failures are skipped, not confirmed screen rejections. Earlier failure counts cannot be reconstructed.</p>
      <p className="muted">The usual trigger runs every four hours. This is saved progress, not a guaranteed completion time. Holdings refresh separately; see their own timestamp.</p>
    </details>
    {!!(status.stats?.priceErrors || status.stats?.analysisErrors || last?.stats?.priceErrors || last?.stats?.analysisErrors) && <p className="error">Some source lookups failed. See data quality above; an empty result may not cover every stock.</p>}
    {(run?.error || status.warning) && <p className="error">{run?.error || status.warning}</p>}
    {stale && <p className="error">No recent scanner activity reported. It may have stopped or timed out; check Apps Script Executions. Do not reset the scan.</p>}
  </div>
}
