// Investing (DESIGN.md §5.13): each member's own stocks and the market scanner's results. Pure helpers, unit-tested.
// The data is written two ways: you keep your symbols / positions on investing/{uid} (this file parses what you type
// or an E*TRADE portfolio CSV), and the market scanner (scripts/market-scanner) writes the daily summary and the
// post-earnings watchlist under investing/{uid}/data.

/** A position you hold (imported from a broker CSV, or typed): how many and what you paid per share. */
export interface Position {
  symbol: string
  qty: number
  /** Price paid per share, when the import had it. */
  paid?: number
}

/** investing/{uid}: your symbols to follow and any positions, yours alone to edit. */
export interface InvestingSettings {
  symbols: string[]
  positions: Position[]
}

/** One stock in the daily summary (investing/{uid}/data/summary, written by the scanner). */
export interface Holding {
  symbol: string
  name?: string
  price?: number
  /** Percent changes. */
  change1d?: number
  change5d?: number
  low52?: number
  high52?: number
  /** What to look at: 'bigDrop1d' | 'bigGain1d' | 'drop5d' | 'gain5d' | 'near52wLow' | 'near52wHigh'. */
  flags: string[]
  news?: { title: string; url: string }[]
}

export interface HoldingsSummary {
  day: string
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

/** One post-earnings dislocation candidate (investing/{uid}/data/watchlist). */
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
}

export interface Watchlist {
  day?: string
  candidates: Candidate[]
  /** How many tickers the universe holds and how many have been scanned this pass. */
  universe?: number
  scanned?: number
  note?: string
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
