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

describe('EDGAR facts', () => {
  // A tiny companyfacts shape: quarterly + annual revenue, cash flows, debt instants, EPS.
  const entry = (start: string, end: string, val: number) => ({ start, end, val })
  const instant = (end: string, val: number) => ({ end, val })
  const facts = {
    facts: {
      'us-gaap': {
        Revenues: {
          units: {
            USD: [
              entry('2024-07-01', '2024-09-30', 1000e6),
              entry('2025-07-01', '2025-09-30', 1180e6),
              entry('2024-01-01', '2024-12-31', 4000e6),
              entry('2023-01-01', '2023-12-31', 3500e6),
            ],
          },
        },
        NetCashProvidedByUsedInOperatingActivities: { units: { USD: [entry('2024-01-01', '2024-12-31', 520e6)] } },
        PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [entry('2024-01-01', '2024-12-31', 160e6)] } },
        LongTermDebtNoncurrent: { units: { USD: [instant('2024-12-31', 800e6), instant('2025-09-30', 700e6)] } },
        CashAndCashEquivalentsAtCarryingValue: { units: { USD: [instant('2025-09-30', 450e6)] } },
        OperatingIncomeLoss: { units: { USD: [entry('2024-01-01', '2024-12-31', 400e6)] } },
        DepreciationDepletionAndAmortization: { units: { USD: [entry('2024-01-01', '2024-12-31', 100e6)] } },
        EarningsPerShareDiluted: {
          units: {
            'USD/shares': [
              entry('2024-10-01', '2024-12-31', 0.5),
              entry('2025-01-01', '2025-03-31', 0.6),
              entry('2025-04-01', '2025-06-30', 0.7),
              entry('2025-07-01', '2025-09-30', 0.7),
              entry('2023-01-01', '2023-12-31', 1.8),
              entry('2024-01-01', '2024-12-31', 2.2),
            ],
          },
        },
      },
    },
  }

  it('computes growth, free cash flow, leverage and valuation from the filing data', () => {
    const got = call<Record<string, number | null>>('factsFrom_', facts, 25, { 2023: 36, 2024: 44 })
    expect(got.revenueGrowth).toBe(18) // 1180 vs 1000, latest quarter YoY
    expect(got.fcf).toBe(360e6) // 520 − 160
    expect(got.fcfMargin).toBe(9) // 360 / 4000
    expect(got.netDebtToEbitda).toBe(0.5) // (700 − 450) / (400 + 100)
    expect(got.epsTtm).toBeCloseTo(2.5) // last four quarters
    expect(got.pe).toBe(10) // 25 / 2.5
    expect(got.peAvg10y).toBeNull() // only two usable years; needs four
  })
  it('falls back to annual revenue growth when quarters are missing', () => {
    const annualOnly = { facts: { 'us-gaap': { Revenues: facts.facts['us-gaap'].Revenues } } }
    const got = call<Record<string, number | null>>('factsFrom_', { facts: { 'us-gaap': { Revenues: { units: { USD: [entry('2024-01-01', '2024-12-31', 4000e6), entry('2023-01-01', '2023-12-31', 3500e6)] } } } } }, null, null)
    expect(got.revenueGrowth).toBeCloseTo(14.29, 1)
    expect(annualOnly).toBeTruthy()
  })
})

describe('insiders, score and flags', () => {
  it('counts open-market purchases in a Form 4', () => {
    const xml = `
      <nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding></nonDerivativeTransaction>
      <nonDerivativeTransaction><transactionCoding><transactionCode>S</transactionCode></transactionCoding></nonDerivativeTransaction>
      <nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding></nonDerivativeTransaction>`
    expect(call('form4Buys_', xml)).toBe(2)
    expect(call('form4Buys_', '<transactionCode>A</transactionCode>')).toBe(0)
  })

  it('scores the worked example at 88', () => {
    // Revenue +18% → 22, FCF margin 9% → 18, net debt/EBITDA 0.5 → 18, P/E 12 vs 20 → 12, 2 buys → 10, sentiment 8 → 8.
    const got = call<{ score: number; parts: Record<string, number> }>('scoreCandidate_', {
      revenueGrowth: 18, fcf: 360e6, fcfMargin: 9, netDebtToEbitda: 0.5, pe: 12, peAvg10y: 20, insiderBuys90d: 2, sentiment: 8,
    })
    expect(got.parts).toEqual({ growth: 22, fcf: 18, balance: 18, valuation: 12, insider: 10, sentiment: 8 })
    expect(got.score).toBe(88)
  })
  it('lands missing data mid-scale and shrinking companies at zero growth points', () => {
    const got = call<{ score: number; parts: Record<string, number> }>('scoreCandidate_', { revenueGrowth: -5, fcf: -10e6, netDebtToEbitda: null, pe: null, peAvg10y: null })
    expect(got.parts).toEqual({ growth: 0, fcf: 0, balance: 10, valuation: 7, insider: 0, sentiment: 5 })
  })

  it('flags the moves worth a look on a summary holding', () => {
    expect(call('holdingFlags_', { price: 80, change1d: -6, change5d: -12, low52: 78, high52: 160 })).toEqual(['bigDrop1d', 'drop5d', 'near52wLow'])
    expect(call('holdingFlags_', { price: 158, change1d: 1, change5d: 2, low52: 78, high52: 160 })).toEqual(['near52wHigh'])
    expect(call('holdingFlags_', { price: 100, change1d: 0.3, change5d: 1, low52: 70, high52: 160 })).toEqual([])
  })
})

describe('odds and ends', () => {
  it('averages monthly closes per calendar year', () => {
    const jan2024 = Date.UTC(2024, 0, 15) / 1000
    const jul2024 = Date.UTC(2024, 6, 15) / 1000
    const mar2025 = Date.UTC(2025, 2, 15) / 1000
    expect(call('yearlyAverages_', { closes: [10, 20, 30], timestamps: [jan2024, jul2024, mar2025] })).toEqual({ 2024: 15, 2025: 30 })
  })
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
  it('pads CIKs and builds a prompt from the verified numbers', () => {
    expect(call('padCik_', 320193)).toBe('0000320193')
    const prompt = call<string>('reportPrompt_', {
      symbol: 'XYZ', name: 'XYZ Corp', drop5d: -27, price: 25,
      facts: { revenueGrowth: 14, fcf: 360e6, fcfMargin: 9, netDebtToEbitda: 0.5, pe: 12, peAvg10y: 20, insiderBuys90d: 2 },
    }, [{ title: 'XYZ tumbles on guidance', url: 'https://example.com' }])
    expect(prompt).toContain('fell 27%')
    expect(prompt).toContain('Revenue growth (latest quarter, year over year): 14%')
    expect(prompt).toContain('XYZ tumbles on guidance')
    expect(prompt).toContain('"Bull case"')
    expect(prompt).toContain('JSON only')
  })
  it('keeps earnings recency honest (a results filing inside the window)', () => {
    const today = new Date().toISOString().slice(0, 10)
    const old = '2020-01-01'
    expect(call('postEarnings_', { form: ['4', '8-K'], filingDate: [today, today] }, 10)).toBe(true)
    expect(call('postEarnings_', { form: ['8-K'], filingDate: [old] }, 10)).toBe(false)
    expect(call('postEarnings_', { form: [], filingDate: [] }, 10)).toBe(false)
  })
})
