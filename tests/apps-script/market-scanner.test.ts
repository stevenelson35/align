// Unit tests for the pure helpers in the market scanner Apps Script. The .gs file is plain JS, loaded into a sandbox.
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

type Fn = (...args: never[]) => unknown
const gs: Record<string, Fn> = createContext({}) as Record<string, Fn>
runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), gs)

const call = <T>(name: string, ...args: unknown[]): T => (gs[name] as (...a: unknown[]) => T)(...args)

const cfg = { MIN_DROP: 15, MAX_DROP: 40, MIN_DOLLAR_VOL: 10e6, MIN_CAP: 2e9, MAX_CAP: 50e9 }

describe('stage 1: the overreaction screen', () => {
  it('measures the 5-trading-day move and the money traded', () => {
    expect(call('drop5d_', [100, 100, 100, 100, 100, 100, 73])).toBe(-27)
    expect(call('drop5d_', [100, 73])).toBeNull()
    expect(call('avgDollarVol_', [10, 20], [1e6, 2e6])).toBe(25e6) // (10M + 40M) / 2
  })
  it('passes a mid-cap down 15–40% on real volume, and nothing else', () => {
    const base = { drop5d: -27, dollarVol: 25e6, marketCap: 8e9 }
    expect(call('stage1Pass_', base, cfg)).toBe(true)
    expect(call('stage1Pass_', { ...base, drop5d: -10 }, cfg)).toBe(false) // not enough of a fall
    expect(call('stage1Pass_', { ...base, drop5d: -55 }, cfg)).toBe(false) // probably a real disaster
    expect(call('stage1Pass_', { ...base, dollarVol: 1e6 }, cfg)).toBe(false) // too thin to trust
    expect(call('stage1Pass_', { ...base, marketCap: 500e6 }, cfg)).toBe(false) // too small
    expect(call('stage1Pass_', { ...base, marketCap: 900e9 }, cfg)).toBe(false) // the whole street watches it
    expect(call('stage1Pass_', { ...base, marketCap: null }, cfg)).toBe(true) // a custom universe carries no caps
  })
})

describe('the universe: Nasdaq Trader symbol files', () => {
  it('keeps plain common stocks from both file shapes', () => {
    const nasdaq = [
      'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',
      'AAAP|Pacer ETF|G|N|N|100|Y|N', // ETF
      'XYZ|XYZ Corp - Common Stock|Q|N|N|100|N|N',
      'ZZZT|NASDAQ TEST|G|Y|N|100|N|N', // test issue
      'TOOLONGG|Units|G|N|N|100|N|N', // not a plain ticker
    ].join('\n')
    const other = [
      'ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol',
      'BIG|Big Co Common Stock|N|BIG|N|100|N|BIG',
      'PRF$A|Preferred Series A|N|PRF-A|N|100|N|PRF-A', // preferred
      'File Creation Time: 1105202603:02||||||',
    ].join('\n')
    expect(call('parseListedSymbols_', nasdaq)).toEqual(['XYZ'])
    expect(call('parseListedSymbols_', other)).toEqual(['BIG'])
    expect(call('parseListedSymbols_', 'nothing|useful\nA|B')).toEqual([])
  })
})

describe('earnings recency', () => {
  const day = 86400000
  const now = Date.now()
  // Yahoo moves the earnings date to the next quarter (~91 days out) as soon as a company reports.
  it('passes when the last report was within the window, estimated from the next date', () => {
    const justReported = (now + 89 * day) / 1000 // reported ~2 days ago
    const reportedLastMonth = (now + 60 * day) / 1000 // reported ~31 days ago
    const aboutToReport = (now + 3 * day) / 1000 // last report ~88 days ago
    expect(call('postEarnings_', justReported, now, 10)).toBe(true)
    expect(call('postEarnings_', reportedLastMonth, now, 10)).toBe(false)
    expect(call('postEarnings_', aboutToReport, now, 10)).toBe(false)
    expect(call('postEarnings_', null, now, 10)).toBe(false) // no scheduled date → fail closed
  })
})

describe('Yahoo fundamentals', () => {
  const raw = (v: number) => ({ raw: v })
  const qs = {
    financialData: {
      revenueGrowth: raw(0.18),
      freeCashflow: raw(360e6),
      totalRevenue: raw(4000e6),
      totalDebt: raw(700e6),
      totalCash: raw(450e6),
      ebitda: raw(500e6),
    },
    defaultKeyStatistics: { trailingEps: raw(1.25), forwardPE: raw(12) },
    netSharePurchaseActivity: { buyInfoCount: raw(2), period: '6m' },
  }

  it('maps quoteSummary numbers to the score inputs', () => {
    expect(call('factsFromSummary_', qs, 25)).toEqual({
      revenueGrowth: 18,
      fcf: 360e6,
      fcfMargin: 9, // 360 / 4000
      netDebtToEbitda: 0.5, // (700 − 450) / 500
      peTrailing: 20, // 25 / 1.25
      peForward: 12,
      insiderBuys6m: 2,
    })
  })
  it('copes with missing modules (nulls, not crashes)', () => {
    expect(call('factsFromSummary_', {}, 25)).toEqual({
      revenueGrowth: null, fcf: null, fcfMargin: null, netDebtToEbitda: null, peTrailing: null, peForward: null, insiderBuys6m: null,
    })
    // Cash above debt is a clean balance sheet even with no EBITDA.
    expect(call<{ netDebtToEbitda: number }>('factsFromSummary_', { financialData: { totalDebt: raw(10e6), totalCash: raw(50e6) } }, 25).netDebtToEbitda).toBe(0)
  })
  it('reads the next earnings date', () => {
    expect(call('nextEarningsSec_', { calendarEvents: { earnings: { earningsDate: [{ raw: 1800000000 }] } } })).toBe(1800000000)
    expect(call('nextEarningsSec_', {})).toBeNull()
  })
})

describe('score and flags', () => {
  it('scores the worked example at 88', () => {
    // Revenue +18% → 22, FCF margin 9% → 18, net debt/EBITDA 0.5 → 18, forward P/E 12 vs trailing 20 → 12, 2 buys → 10, sentiment 8 → 8.
    const got = call<{ score: number; parts: Record<string, number> }>('scoreCandidate_', {
      revenueGrowth: 18, fcf: 360e6, fcfMargin: 9, netDebtToEbitda: 0.5, peForward: 12, peTrailing: 20, insiderBuys6m: 2, sentiment: 8,
    })
    expect(got.parts).toEqual({ growth: 22, fcf: 18, balance: 18, valuation: 12, insider: 10, sentiment: 8 })
    expect(got.score).toBe(88)
  })
  it('lands missing data mid-scale and shrinking companies at zero growth points', () => {
    const got = call<{ score: number; parts: Record<string, number> }>('scoreCandidate_', { revenueGrowth: -5, fcf: -10e6, netDebtToEbitda: null, peForward: null, peTrailing: null })
    expect(got.parts).toEqual({ growth: 0, fcf: 0, balance: 10, valuation: 7, insider: 0, sentiment: 5 })
  })

  it('flags the moves worth a look on a summary holding', () => {
    expect(call('holdingFlags_', { price: 80, change1d: -6, change5d: -12, low52: 78, high52: 160 })).toEqual(['bigDrop1d', 'drop5d', 'near52wLow'])
    expect(call('holdingFlags_', { price: 158, change1d: 1, change5d: 2, low52: 78, high52: 160 })).toEqual(['near52wHigh'])
    expect(call('holdingFlags_', { price: 100, change1d: 0.3, change5d: 1, low52: 70, high52: 160 })).toEqual([])
  })
})

describe('odds and ends', () => {
  it('reads RSS items, CDATA and entities included', () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Shares fall 27% after Q3 miss]]></title><link>https://example.com/a</link></item>
      <item><title>Analysts &amp; insiders react</title><link>https://example.com/b</link></item>
    </channel></rss>`
    expect(call('parseRssItems_', xml)).toEqual([
      { title: 'Shares fall 27% after Q3 miss', url: 'https://example.com/a' },
      { title: 'Analysts & insiders react', url: 'https://example.com/b' },
    ])
  })
  it('builds the prompt from the verified numbers', () => {
    const prompt = call<string>('reportPrompt_', {
      symbol: 'XYZ', name: 'XYZ Corp', drop5d: -27, price: 25,
      facts: { revenueGrowth: 18, fcf: 360e6, fcfMargin: 9, netDebtToEbitda: 0.5, peTrailing: 20, peForward: 12, insiderBuys6m: 2 },
    }, [{ title: 'XYZ tumbles on guidance', url: 'https://example.com' }])
    expect(prompt).toContain('fell 27%')
    expect(prompt).toContain('Revenue growth (latest quarter, year over year): 18%')
    expect(prompt).toContain('trailing 20, forward 12')
    expect(prompt).toContain('XYZ tumbles on guidance')
    expect(prompt).toContain('"Bull case"')
    expect(prompt).toContain('JSON only')
  })
})
