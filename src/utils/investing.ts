// Investing (DESIGN.md §5.13): each member's own stocks and the market scanner's results. Pure helpers, unit-tested.
// Each investmentLists/{id} has its own audience; scanner data inherits access from its parent list.
import type { PrivacyFields } from './audience'

/** A position you hold (imported from a broker CSV, or typed): how many and what you paid per share. */
export interface Position {
  symbol: string
  qty: number
  /** Price paid per share, when the import had it. */
  paid?: number
}

/** A holdings list's symbols and positions; also used by legacy investing/{uid}. */
export interface InvestingSettings {
  symbols: string[]
  positions: Position[]
}

export interface InvestmentList extends InvestingSettings, PrivacyFields {
  id: string
  ownerId: string
  name: string
  kind: 'holdings' | 'overreactions'
}

export function sortInvestmentLists(lists: InvestmentList[]): InvestmentList[] {
  return [...lists].sort((a, b) => Number(a.kind === 'overreactions') - Number(b.kind === 'overreactions') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function priceContext(h: Pick<Holding, 'price' | 'low52' | 'high52'>): { belowHigh: number; rangePosition?: number } | null {
  if (h.price == null || h.high52 == null || h.high52 <= 0) return null
  return {
    belowHigh: (h.price / h.high52 - 1) * 100,
    ...(h.low52 != null && h.high52 > h.low52 ? { rangePosition: (h.price - h.low52) / (h.high52 - h.low52) * 100 } : {}),
  }
}

/** One stock in investmentLists/{id}/data/summary, written by the scanner. */
export interface Holding {
  symbol: string
  name?: string
  price?: number
  /** Percent changes. */
  change1d?: number
  change5d?: number
  low52?: number
  high52?: number
  peTrailing?: number | null
  peForward?: number | null
  industry?: string
  valuationError?: string
  valuationCheckedAt?: string
  error?: string
  peerComparison?: {
    count: number
    medianForwardPe: number
    premiumPct: number
  }
  /** What to look at: 'bigDrop1d' | 'bigGain1d' | 'drop5d' | 'gain5d' | 'near52wLow' | 'near52wHigh'. */
  flags: string[]
  news?: { title: string; url: string }[]
}

export interface HoldingsSummary {
  day: string
  generatedAt?: string
  priceErrors?: number
  valuationIssues?: number
  holdings: Holding[]
  note?: string
}

/** The screener's numbers for one candidate (what the score is made of). */
export interface CandidateFacts {
  revenueGrowth?: number
  fcf?: number
  fcfMargin?: number
  netDebtToEbitda?: number
  /** Insider purchases Yahoo reports for the last 6 months. */
  insiderBuys6m?: number
  peTrailing?: number
  peForward?: number
}

/** One post-earnings dislocation candidate (investmentLists/{id}/data/watchlist). */
export interface Candidate {
  symbol: string
  name: string
  score: number
  parts?: Record<string, number>
  price?: number
  /** The 5-day fall that put it on the list (a negative percent). */
  drop5d?: number
  marketCap?: number
  facts: CandidateFacts
  /** The AI's recovery probability estimate (0–100), when a Gemini key is set. */
  recovery?: number
  /** The one-page write-up: why it fell, fundamentals, bull / bear case, analogs. */
  report?: string
  /** Whether report generation succeeded, failed, was not configured, or was not attempted. */
  reportStatus?: 'generated' | 'failed' | 'not_configured' | 'not_attempted'
  /** When the report request started and, if successful, when the report was returned. */
  reportAttemptedAt?: string
  reportGeneratedAt?: string
}

export interface Watchlist {
  day?: string
  scannedAt?: string
  candidates: Candidate[]
  /** How many tickers the universe holds and how many have been scanned this pass. */
  universe?: number
  scanned?: number
  note?: string
  stats?: ScannerStats | null
}

export interface ScannerStats {
  since: string
  priceErrors: number
  analyzed: number
  analysisErrors: number
}

export interface ScannerWork {
  screened: number
  priceErrors: number
  analyzed: number
  analysisErrors: number
  qualified: number
}

export interface ScannerStatus {
  updatedAt: string
  execution: 'running' | 'idle' | 'error' | 'snapshot'
  stage: 'refreshing' | 'building' | 'screening' | 'analyzing' | 'completed'
  universe: number
  screened: number
  queued: number
  qualified: number
  buildTotal: number
  buildChecked: number
  stats?: ScannerStats | null
  lastRun?: {
    startedAt: string
    finishedAt?: string
    error?: string
    completed?: boolean
    work: ScannerWork
  } | null
  lastPass?: {
    completedAt: string
    screened: number
    qualified: number
    kept: number
    stats?: ScannerStats
  } | null
  lastWatchlistAt?: string | null
  warning?: string
}

/** Phase progress, not a fabricated overall percentage across differently sized stages. */
export function scannerProgress(s: ScannerStatus): { label: string; done: number; total: number; percent: number } | null {
  const building = s.stage === 'building'
  const total = building ? s.buildTotal : s.universe
  if (!(total > 0)) return null
  const done = Math.max(0, Math.min(total, building ? s.buildChecked : s.stage === 'completed' ? total : s.screened))
  return { label: building ? 'Universe sizing' : 'Price screening', done, total, percent: Math.floor(done / total * 100) }
}

export function scannerStale(s: ScannerStatus, now = Date.now()): boolean {
  const activity = s.lastRun?.finishedAt ?? s.lastRun?.startedAt ?? s.updatedAt
  const age = now - new Date(activity).getTime()
  return Number.isFinite(age) && age > (s.execution === 'running' ? 10 * 60000 : 8 * 3600000)
}

export function peLabel(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'not supplied in this result'
  return value > 0 ? `${value.toFixed(1)}×` : 'not meaningful (non-positive)'
}

export function scannerTime(value?: string): string {
  if (!value) return 'date not recorded'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isFinite(date.getTime()) ? value.length === 10 ? date.toLocaleDateString() : date.toLocaleString() : value
}

/** A ticker symbol, cleaned ("aapl " → "AAPL"), or null when it isn't one. */
export function cleanSymbol(text: string): string | null {
  const s = text.trim().toUpperCase()
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(s) ? s : null
}

/** Symbols typed into the add box ("aapl, msft nvda") → cleaned, unique, in order. */
export function parseSymbols(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/[\s,;]+/)) {
    const s = cleanSymbol(part)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/** One CSV line → cells (quotes and embedded commas handled; enough for broker exports). */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells
}

const num = (cell: string | undefined): number | undefined => {
  if (!cell) return undefined
  const n = Number(cell.replace(/[$,%\s]/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/**
 * A broker portfolio CSV (e.g. E*TRADE's "Download → Spreadsheet") → positions. Finds the header row with a Symbol
 * column (exports start with account-summary lines), reads Quantity / Qty / Shares and Price Paid / Cost per share,
 * skips CASH / TOTAL rows, and adds up multiple lots of the same symbol (averaging what was paid).
 */
export function parsePortfolioCsv(text: string): Position[] {
  const lines = text.split(/\r?\n/)
  let cols: { symbol: number; qty: number; paid: number } | null = null
  const bySymbol = new Map<string, { qty: number; cost: number; costQty: number }>()
  for (const line of lines) {
    const cells = parseCsvLine(line).map((c) => c.trim())
    if (!cols) {
      const lower = cells.map((c) => c.toLowerCase())
      const symbol = lower.findIndex((c) => c === 'symbol' || c === 'ticker')
      if (symbol < 0) continue
      const qty = lower.findIndex((c) => /^(quantity|qty|shares)\b/.test(c))
      const paid = lower.findIndex((c) => /^(price paid|cost per share|avg cost|average cost)/.test(c))
      cols = { symbol, qty, paid }
      continue
    }
    const raw = cells[cols.symbol]
    if (!raw || /^(cash|total)\b/i.test(raw)) continue
    const symbol = cleanSymbol(raw)
    const qty = cols.qty >= 0 ? num(cells[cols.qty]) : undefined
    if (!symbol || qty === undefined || qty <= 0) continue
    const paid = cols.paid >= 0 ? num(cells[cols.paid]) : undefined
    const have = bySymbol.get(symbol) ?? { qty: 0, cost: 0, costQty: 0 }
    have.qty += qty
    if (paid !== undefined) {
      have.cost += paid * qty
      have.costQty += qty
    }
    bySymbol.set(symbol, have)
  }
  return [...bySymbol.entries()].map(([symbol, p]) => ({
    symbol,
    qty: p.qty,
    ...(p.costQty > 0 ? { paid: Math.round((p.cost / p.costQty) * 100) / 100 } : {}),
  }))
}

/** Imported positions replace the ones already there for the same symbol; others stay. */
export function mergePositions(current: Position[], imported: Position[]): Position[] {
  const replaced = new Set(imported.map((p) => p.symbol))
  return [...current.filter((p) => !replaced.has(p.symbol)), ...imported]
}

/** Every symbol to follow: the ones typed plus the ones held. */
export function allSymbols(s: InvestingSettings): string[] {
  return [...new Set([...s.symbols, ...s.positions.map((p) => p.symbol)])]
}

/** What a flag means, for the row's badge. */
export const FLAG_LABELS: Record<string, string> = {
  bigDrop1d: 'big drop today',
  bigGain1d: 'big gain today',
  drop5d: 'down this week',
  gain5d: 'up this week',
  near52wLow: 'near 52-week low',
  near52wHigh: 'near 52-week high',
}
