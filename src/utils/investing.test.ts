import { describe, expect, it } from 'vitest'
import { allSymbols, cleanSymbol, mergePositions, parseCsvLine, parsePortfolioCsv, parseSymbols, peLabel, priceContext, scannerProgress, scannerStale, sortInvestmentLists, type InvestmentList, type ScannerStatus } from './investing'

describe('scanner visibility and valuation labels', () => {
  const status: ScannerStatus = {
    updatedAt: '2026-11-05T12:00:00Z', execution: 'idle', stage: 'screening',
    universe: 1706, screened: 200, queued: 21, qualified: 0, buildTotal: 0, buildChecked: 0,
  }
  it('reports the real price-screening fraction without claiming overall scan completion', () => {
    expect(scannerProgress(status)).toEqual({ label: 'Price screening', done: 200, total: 1706, percent: 11 })
    expect(scannerProgress({ ...status, stage: 'analyzing', screened: 1706 })?.percent).toBe(100)
    expect(scannerProgress({ ...status, stage: 'building', buildChecked: 80, buildTotal: 400 })?.percent).toBe(20)
    expect(scannerProgress({ ...status, stage: 'building' })).toBeNull()
    expect(scannerProgress({ ...status, screened: -1 })?.done).toBe(0)
    expect(scannerProgress({ ...status, screened: 9999 })?.percent).toBe(100)
  })
  it('does not mistake a fresh saved snapshot for recent execution activity', () => {
    const now = new Date('2026-11-05T20:00:01Z').getTime()
    expect(scannerStale(status, now)).toBe(true)
    expect(scannerStale({ ...status, execution: 'running' }, new Date('2026-11-05T12:11:00Z').getTime())).toBe(true)
    expect(scannerStale({ ...status, execution: 'snapshot', updatedAt: '2026-11-05T20:00:00Z', lastRun: {
      startedAt: '2026-11-05T10:00:00Z', finishedAt: '2026-11-05T10:05:00Z',
      work: { screened: 200, priceErrors: 1, analyzed: 0, analysisErrors: 0, qualified: 0 },
    } }, now)).toBe(true)
    expect(scannerStale(status, new Date('2026-11-05T16:00:00Z').getTime())).toBe(false)
  })
  it('distinguishes missing data from a non-positive valuation ratio', () => {
    expect(peLabel(19.4)).toBe('19.4×')
    expect(peLabel(null)).toBe('not supplied in this result')
    expect(peLabel(undefined)).toBe('not supplied in this result')
    expect(peLabel(NaN)).toBe('not supplied in this result')
    expect(peLabel(-4)).toBe('not meaningful (non-positive)')
    expect(peLabel(0)).toBe('not meaningful (non-positive)')
  })
})

describe('investment lists and price context', () => {
  it('keeps overreactions after every ordinary list', () => {
    const base = { ownerId: 'steve', visibility: 'private' as const, viewerVisible: false, symbols: [], positions: [] }
    const lists: InvestmentList[] = [
      { ...base, id: 'report', name: 'A report', kind: 'overreactions' },
      { ...base, id: 'b', name: 'B stocks', kind: 'holdings' },
      { ...base, id: 'a', name: 'A stocks', kind: 'holdings' },
    ]
    expect(sortInvestmentLists(lists).map((l) => l.id)).toEqual(['a', 'b', 'report'])
    expect(lists[0].id).toBe('report')
  })
  it('distinguishes price context from valuation and handles flat or missing ranges', () => {
    expect(priceContext({ price: 75, high52: 100, low52: 50 })).toEqual({ belowHigh: -25, rangePosition: 50 })
    expect(priceContext({ price: 100, high52: 100, low52: 100 })).toEqual({ belowHigh: 0 })
    expect(priceContext({})).toBeNull()
    expect(priceContext({ price: 10, high52: 0 })).toBeNull()
  })
})

describe('cleanSymbol / parseSymbols', () => {
  it('cleans tickers and refuses what isn’t one', () => {
    expect(cleanSymbol(' aapl ')).toBe('AAPL')
    expect(cleanSymbol('BRK.B')).toBe('BRK.B')
    expect(cleanSymbol('')).toBeNull()
    expect(cleanSymbol('123')).toBeNull()
    expect(cleanSymbol('WAY-TOO-LONG-NAME')).toBeNull()
  })
  it('splits what was typed, unique and in order', () => {
    expect(parseSymbols('aapl, msft NVDA aapl')).toEqual(['AAPL', 'MSFT', 'NVDA'])
    expect(parseSymbols('')).toEqual([])
  })
})

describe('parseCsvLine', () => {
  it('handles quotes and embedded commas', () => {
    expect(parseCsvLine('AAPL,"1,234.50",10')).toEqual(['AAPL', '1,234.50', '10'])
    expect(parseCsvLine('a,"say ""hi""",b')).toEqual(['a', 'say "hi"', 'b'])
  })
})

describe('parsePortfolioCsv', () => {
  const etrade = [
    'Account Summary,,,,,,,,,,',
    'Net Account Value,"$12,345.67",,,,,,,,,',
    '',
    "Symbol,Last Price $,Change $,Change %,Volume,Quantity,Price Paid $,Day's Gain $,Total Gain $,Total Gain %,Value $",
    'AAPL,189.95,1.50,0.80,"52,341,234",10,150.25,15.00,397.00,26.40,"1,899.50"',
    'MSFT,410.10,-2.00,-0.49,"18,222,111",5,"300.00",-10.00,550.50,36.70,"2,050.50"',
    'AAPL,189.95,1.50,0.80,"52,341,234",2,180.00,3.00,19.90,5.50,379.90',
    'CASH,,,,,,,,,,"1,234.56"',
    'TOTAL,,,,,,,,,,"5,564.46"',
  ].join('\n')

  it('reads an E*TRADE portfolio download, summing lots and averaging the price paid', () => {
    expect(parsePortfolioCsv(etrade)).toEqual([
      { symbol: 'AAPL', qty: 12, paid: 155.21 }, // (10×150.25 + 2×180) / 12
      { symbol: 'MSFT', qty: 5, paid: 300 },
    ])
  })
  it('copes with a plain symbol/qty export and with nothing useful', () => {
    expect(parsePortfolioCsv('Ticker,Shares\nvoo,3')).toEqual([{ symbol: 'VOO', qty: 3 }])
    expect(parsePortfolioCsv('no header here\njust,words')).toEqual([])
  })
})

describe('positions', () => {
  it('merges an import over what’s there and lists every symbol once', () => {
    const current = [{ symbol: 'AAPL', qty: 1, paid: 100 }, { symbol: 'VOO', qty: 2 }]
    const merged = mergePositions(current, [{ symbol: 'AAPL', qty: 12, paid: 155.21 }])
    expect(merged).toEqual([{ symbol: 'VOO', qty: 2 }, { symbol: 'AAPL', qty: 12, paid: 155.21 }])
    expect(allSymbols({ symbols: ['NVDA', 'AAPL'], positions: merged })).toEqual(['NVDA', 'AAPL', 'VOO'])
  })
})
