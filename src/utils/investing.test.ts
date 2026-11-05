import { describe, expect, it } from 'vitest'
import { allSymbols, cleanSymbol, mergePositions, parseCsvLine, parsePortfolioCsv, parseSymbols } from './investing'

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
