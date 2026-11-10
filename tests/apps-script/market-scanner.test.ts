// Unit tests for the pure helpers in the market scanner Apps Script. The .gs file is plain JS, loaded into a sandbox.
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

type Fn = (...args: never[]) => unknown
const gs: Record<string, Fn> = createContext({}) as Record<string, Fn>
runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), gs)

const call = <T>(name: string, ...args: unknown[]): T => (gs[name] as (...a: unknown[]) => T)(...args)

const cfg = { MIN_DROP: 15, MAX_DROP: 40, MIN_DOLLAR_VOL: 10e6, MIN_CAP: 2e9, MAX_CAP: 50e9 }

describe('published scanner ranking', () => {
  it('keeps the highest-scoring ten across the pass, not the first ten encountered', () => {
    const published: { universe: number; scanned: number; candidates: { symbol: string; score: number }[] }[] = []
    const sandbox = createContext({
      Utilities: { formatDate: () => '2026-11-07' },
      Logger: { log: () => {} },
      testApi: { set: (_path: string, data: typeof published[number]) => published.push(data) },
      testUsers: [{ id: 'feed', fields: { kind: 'overreactions' } }],
      testState: {
        universe: Array.from({ length: 100 }, (_, i) => [`S${i}`, 5e9]),
        scored: Array.from({ length: 15 }, (_, i) => ({ symbol: `S${i}`, score: 61 + i })),
      },
      testCfg: { TIME_ZONE: 'America/New_York' },
    })
    runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), sandbox)
    runInContext('publishWatchlist_(testApi, testUsers, testState, testCfg)', sandbox)
    expect(published).toHaveLength(1)
    expect(published[0]).toMatchObject({ universe: 100, scanned: 100 })
    expect(published[0].candidates.map((c) => c.symbol)).toEqual(['S14', 'S13', 'S12', 'S11', 'S10', 'S9', 'S8', 'S7', 'S6', 'S5'])
  })
})

describe('standalone Gemini diagnostics', () => {
  function diagnostic(response: unknown, code = 200, properties: Record<string, string> = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }) {
    const logs: unknown[][] = []
    const requests: string[] = []
    const sandbox = createContext({
      PropertiesService: { getScriptProperties: () => ({ getProperties: () => properties }) },
      Logger: { log: (...args: unknown[]) => logs.push(args) },
      UrlFetchApp: { fetch: (url: string) => {
        requests.push(url)
        return { getResponseCode: () => code, getContentText: () => JSON.stringify(response) }
      } },
    })
    runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), sandbox)
    return { run: () => runInContext('checkGemini()', sandbox), logs, requests, sandbox }
  }
  it('uses the configured model and reports success without Firebase credentials or state access', () => {
    const d = diagnostic({ candidates: [{ content: { parts: [{ text: '{"report":"Synthetic note","sentiment":8,"recovery":50}' }] }, finishReason: 'STOP' }] })
    d.run()
    expect(d.requests).toHaveLength(1)
    expect(d.requests[0]).toContain('/models/test-model:generateContent')
    expect(d.logs.at(-1)).toEqual(['Gemini succeeded: %s report characters. Synthetic test note:\n%s', 14, 'Synthetic note'])
    expect(JSON.stringify(d.logs)).not.toContain('test-key')
  })
  it('fails before requesting when the key is absent', () => {
    const d = diagnostic({}, 200, {})
    expect(d.run).toThrow('Missing GEMINI_API_KEY')
    expect(d.requests).toHaveLength(0)
  })
  it('defaults to the replacement model while normal scans preserve explicit model overrides', () => {
    const d = diagnostic({ candidates: [{ content: { parts: [{ text: '{"report":"Synthetic note"}' }] } }] }, 200, { GEMINI_API_KEY: 'test-key' })
    d.run()
    expect(d.requests[0]).toContain('/models/gemini-3.8-flash:generateContent')
    const required = { FIREBASE_API_KEY: 'demo', FIREBASE_PROJECT_ID: 'demo-align', BOT_EMAIL: 'bot@example.com', BOT_PASSWORD: 'test', TIME_ZONE: 'UTC' }
    Object.assign(d.sandbox, { testProperties: required })
    expect(runInContext('scanConfig_(testProperties).GEMINI_MODEL', d.sandbox)).toBe('gemini-3.8-flash')
    Object.assign(d.sandbox, { testProperties: { ...required, GEMINI_MODEL: 'custom-model' } })
    expect(runInContext('scanConfig_(testProperties).GEMINI_MODEL', d.sandbox)).toBe('custom-model')
  })
  it('surfaces API status and quota errors', () => {
    const d = diagnostic({ error: { message: 'Quota exceeded' } }, 429)
    expect(d.run).toThrow('failed (429)')
    expect(d.run).toThrow('Quota exceeded')
  })
  it('reports blocked responses, invalid JSON and empty notes explicitly', () => {
    expect(diagnostic({ promptFeedback: { blockReason: 'SAFETY' } }).run).toThrow('block reason: SAFETY')
    expect(diagnostic({ candidates: [{ finishReason: 'MAX_TOKENS' }] }).run).toThrow('Finish reason: MAX_TOKENS')
    expect(diagnostic({ candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] }).run).toThrow()
    expect(diagnostic({ candidates: [{ content: { parts: [{ text: '{"report":" "}' }] } }] }).run).toThrow('without a non-empty report')
  })
  it('combines output text while excluding thought parts and preserves the normal-scan fallback', () => {
    const d = diagnostic({ candidates: [{ content: { parts: [{ thought: true, text: 'internal text' }, { text: '{"report":' }, { text: '"Synthetic note"}' }] } }] })
    d.run()
    const failed = diagnostic({ error: { message: 'Quota exceeded' } }, 429)
    const result = runInContext('gemini_({GEMINI_API_KEY:"test-key", GEMINI_MODEL:"test-model", GEMINI_URL:DEFAULTS.GEMINI_URL}, "test")', failed.sandbox)
    expect(result).toEqual({ sentiment: 5, recovery: null, report: '' })
    expect(failed.logs[0][0]).toBe('Gemini call failed: %s')
  })
})

describe('candidate report status', () => {
  function analyze(apiKey: string, report: string) {
    const sandbox = createContext({})
    runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), sandbox)
    Object.assign(sandbox, {
      yahooQuoteSummary_: () => ({ price: { longName: 'Synthetic Company' } }),
      postEarnings_: () => true,
      factsFromSummary_: () => ({ revenueGrowth: 10 }),
      news_: () => [],
      scoreCandidate_: () => ({ score: 80, parts: {} }),
      cleanFacts_: (facts: unknown) => facts,
      reportPrompt_: () => 'synthetic prompt',
      gemini_: () => ({ sentiment: 8, recovery: 50, report }),
      testCandidate: { symbol: 'SYN', price: 25, drop5d: -20, cap: 5e9 },
      testConfig: { GEMINI_API_KEY: apiKey, MIN_SCORE: 60 },
    })
    return runInContext('analyze_(testCandidate, testConfig)', sandbox) as Record<string, unknown> | null
  }

  it('records a successful report and both timestamps', () => {
    const candidate = analyze('configured', 'Synthetic report')
    expect(candidate).toMatchObject({ reportStatus: 'generated', report: expect.stringContaining('Synthetic report') })
    expect(candidate?.reportAttemptedAt).toEqual(expect.any(String))
    expect(candidate?.reportGeneratedAt).toEqual(expect.any(String))
  })

  it('records a failed attempt without treating the disclaimer as a report', () => {
    const candidate = analyze('configured', '')
    expect(candidate).toMatchObject({
      reportStatus: 'failed',
      report: 'This is an automated research note, not investment advice.',
    })
    expect(candidate?.reportAttemptedAt).toEqual(expect.any(String))
    expect(candidate?.reportGeneratedAt).toBeNull()
  })

  it('records when report generation was not configured', () => {
    const candidate = analyze('', '')
    expect(candidate).toMatchObject({
      reportStatus: 'not_configured',
      report: 'This is an automated research note, not investment advice.',
      reportAttemptedAt: null,
      reportGeneratedAt: null,
    })
  })
})

describe('list-local peer comparisons', () => {
  it('compares positive forward P/Es only within the exact industry, excluding the subject', () => {
    const holdings = [
      { symbol: 'A', industry: 'Software', peForward: 10 },
      { symbol: 'B', industry: 'Software', peForward: 20 },
      { symbol: 'C', industry: 'Software', peForward: 30 },
      { symbol: 'D', industry: 'Software', peForward: 40 },
      { symbol: 'E', industry: 'Banks', peForward: 5 },
      { symbol: 'F', industry: 'Software', peForward: -3 },
    ]
    call('addPeerComparisons_', holdings)
    expect(holdings[0]).toMatchObject({ peerComparison: { count: 3, medianForwardPe: 30, premiumPct: -66.67 } })
    expect(holdings[4]).not.toHaveProperty('peerComparison')
    expect(holdings[5]).not.toHaveProperty('peerComparison')
  })
  it('does not imply an industry benchmark from two peers', () => {
    const holdings = ['A', 'B', 'C'].map((symbol) => ({ symbol, industry: 'Software', peForward: 10 }))
    call('addPeerComparisons_', holdings)
    expect(holdings.every((h) => !('peerComparison' in h))).toBe(true)
  })
})

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
  it('uses Yahoo summaryDetail ratios when key statistics omit EPS or forward PE', () => {
    expect(call('factsFromSummary_', { summaryDetail: { trailingPE: raw(18.4), forwardPE: raw(16.2) } }, 100)).toMatchObject({
      peTrailing: 18.4, peForward: 16.2,
    })
    expect(call('factsFromSummary_', { summaryDetail: { trailingPE: 18.4 }, defaultKeyStatistics: { forwardPE: 16.2 } }, 100)).toMatchObject({
      peTrailing: 18.4, peForward: 16.2,
    })
    expect(call('factsFromSummary_', { defaultKeyStatistics: { trailingEps: raw(-5), forwardPE: raw(-10) } }, 100)).toMatchObject({
      peTrailing: -20, peForward: -10,
    })
  })
})

describe('saved scanner progress', () => {
  it('reads a pre-telemetry pass without mutating its universe, cursor or queue', () => {
    const state = { universe: Array(1706).fill(['XYZ', 8e9]), universeAt: '2026-11-05T11:05:00Z', cursor: 200, passers: Array(21).fill({ symbol: 'XYZ' }), scored: [] }
    const before = JSON.stringify(state)
    expect(call('scannerStatus_', state, 'snapshot')).toMatchObject({
      execution: 'snapshot', stage: 'screening', universe: 1706, screened: 200, queued: 21, qualified: 0,
      stats: null, lastRun: null, lastPass: null,
    })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('distinguishes building, analyzing and completed passes while retaining last-pass details', () => {
    expect(call('scannerStatus_', { tickers: ['A', 'B'], tickCursor: 1 }, 'idle')).toMatchObject({ stage: 'building', buildTotal: 2, buildChecked: 1 })
    expect(call('scannerStatus_', { universe: [['A', 1]], cursor: 1, passers: [{ symbol: 'A' }] }, 'idle')).toMatchObject({ stage: 'analyzing', queued: 1 })
    expect(call('scannerStatus_', { universe: [['A', 1]], cursor: 0, lastPass: { kept: 1 }, lastRun: { completed: true } }, 'idle')).toMatchObject({ stage: 'completed', lastPass: { kept: 1 } })
    expect(call('scannerStatus_', { universe: [['A', 1]], cursor: 0, lastPass: { kept: 1 }, lastRun: {} }, 'running')).toMatchObject({ stage: 'screening', lastPass: { kept: 1 } })
  })
  it('refuses to silently reset corrupt saved state', () => {
    expect(() => call('stateLoad_', { getProperty: (key: string) => key.endsWith('.n') ? '1' : '{broken' })).toThrow('Do not reset')
    expect(() => call('stateLoad_', { getProperty: (key: string) => key.endsWith('.n') ? 'not-a-count' : null })).toThrow('Do not reset')
    expect(() => call('stateLoad_', { getProperty: (key: string) => key.endsWith('.n') ? '1' : null })).toThrow('Do not reset')
    expect(() => call('stateLoad_', { getProperty: (key: string) => key.endsWith('.0') ? '{}' : null })).toThrow('Do not reset')
    expect(call('stateLoad_', { getProperty: () => null })).toEqual({})
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
  it('does not score negative earnings multiples as a cheap valuation', () => {
    expect(call<{ parts: { valuation: number } }>('scoreCandidate_', { peForward: -10, peTrailing: 20 }).parts.valuation).toBe(7)
    expect(call<{ parts: { valuation: number } }>('scoreCandidate_', { peForward: -20, peTrailing: -10 }).parts.valuation).toBe(7)
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
