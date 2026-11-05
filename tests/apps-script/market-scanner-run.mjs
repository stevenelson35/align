// Runs the real market scanner Apps Script against the local emulators, with canned market data standing in for
// Yahoo, SEC EDGAR and Google News. Needs `npm run emulators` and `npm run seed` first. Usage: npm run test:scanner
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: 'demo-align' })
const admin = getFirestore()

const props = {
  FIREBASE_API_KEY: 'demo-key',
  FIREBASE_PROJECT_ID: 'demo-align',
  BOT_EMAIL: 'calendar-bot@example.com',
  BOT_PASSWORD: 'align-dev',
  EDGAR_CONTACT: 'Align scanner test@example.com',
  AUTH_URL: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'http://127.0.0.1:8080/v1',
}

// ---- Canned market data ----
// XYZ: a $8.2B mid-cap down 27% in 5 days right after an 8-K, growing, cash-flowing, insiders buying → a candidate.
// FLAT: a $5B mid-cap that didn't move → screened out at stage 1. BIG: $900B → not in the universe.
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const chart = (closes, volumes, timestamps) => ({
  chart: { result: [{ timestamp: timestamps ?? closes.map((_, i) => 1700000000 + i * 86400), indicators: { quote: [{ close: closes, volume: volumes ?? closes.map(() => 2e6) }] }, meta: { shortName: 'Chart Co' } }] },
})
const steady = (price) => chart(Array.from({ length: 30 }, () => price))
const dropped = chart([...Array.from({ length: 24 }, () => 34.5), 34.5, 30, 28, 26, 25.4, 25.1]) // −27.2% over 5 trading days
const monthly10y = chart(
  Array.from({ length: 120 }, (_, i) => 20 + (i % 10)),
  Array.from({ length: 120 }, () => 1e6),
  Array.from({ length: 120 }, (_, i) => Math.floor(Date.UTC(2016 + Math.floor(i / 12), i % 12, 15) / 1000)),
)
const entry = (start, end, val) => ({ start, end, val })
const instant = (end, val) => ({ end, val })
const companyFacts = {
  facts: {
    'us-gaap': {
      Revenues: { units: { USD: [entry('2024-07-01', '2024-09-30', 1000e6), entry('2025-07-01', '2025-09-30', 1180e6), entry('2024-01-01', '2024-12-31', 4000e6), entry('2023-01-01', '2023-12-31', 3500e6)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [entry('2024-01-01', '2024-12-31', 520e6)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [entry('2024-01-01', '2024-12-31', 160e6)] } },
      LongTermDebtNoncurrent: { units: { USD: [instant('2025-09-30', 700e6)] } },
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [instant('2025-09-30', 450e6)] } },
      OperatingIncomeLoss: { units: { USD: [entry('2024-01-01', '2024-12-31', 400e6)] } },
      DepreciationDepletionAndAmortization: { units: { USD: [entry('2024-01-01', '2024-12-31', 100e6)] } },
      EarningsPerShareDiluted: {
        units: { 'USD/shares': [entry('2024-10-01', '2024-12-31', 0.5), entry('2025-01-01', '2025-03-31', 0.6), entry('2025-04-01', '2025-06-30', 0.7), entry('2025-07-01', '2025-09-30', 0.7)] },
      },
    },
  },
}
const submissions = {
  name: 'XYZ Corp',
  filings: {
    recent: {
      form: ['4', '8-K', '4', '10-Q'],
      filingDate: [day(-1), day(-2), day(-3), day(-80)],
      accessionNumber: ['0001-24-000001', '0001-24-000002', '0001-24-000003', '0001-24-000004'],
      primaryDocument: ['form4a.xml', 'earnings.htm', 'form4b.xml', 'tenq.htm'],
    },
  },
}
const form4 = '<nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding></nonDerivativeTransaction>'
const rss = '<rss><channel><item><title><![CDATA[XYZ tumbles on guidance]]></title><link>https://example.com/xyz</link></item></channel></rss>'

const canned = (url) => {
  if (url.includes('company_tickers.json'))
    return JSON.stringify({ 0: { cik_str: 1, ticker: 'XYZ', title: 'XYZ Corp' }, 1: { cik_str: 2, ticker: 'FLAT', title: 'Flat Co' }, 2: { cik_str: 3, ticker: 'BIG', title: 'Big Co' }, 3: { cik_str: 4, ticker: 'UN-IT', title: 'Unit Co' } })
  if (url.includes('fc.yahoo.com')) return { headers: { 'Set-Cookie': 'A3=test; Path=/' }, body: '' }
  if (url.includes('getcrumb')) return 'test-crumb'
  if (url.includes('/v7/finance/quote')) return JSON.stringify({ quoteResponse: { result: [{ symbol: 'XYZ', marketCap: 8.2e9 }, { symbol: 'FLAT', marketCap: 5e9 }, { symbol: 'BIG', marketCap: 900e9 }] } })
  if (url.includes('/v8/finance/chart/XYZ')) return JSON.stringify(url.includes('interval=1mo') ? monthly10y : dropped)
  if (url.includes('/v8/finance/chart/')) return JSON.stringify(steady(100))
  if (url.includes('data.sec.gov/submissions/')) return JSON.stringify(submissions)
  if (url.includes('api/xbrl/companyfacts/')) return JSON.stringify(companyFacts)
  if (url.includes('form4')) return form4
  if (url.includes('news.google.com')) return rss
  return null
}

let lockHeld = false
const cache = new Map()
const sandbox = createContext({
  console,
  Logger: { log: (...args) => console.log('  [script]', ...args) },
  LockService: { getScriptLock: () => ({ tryLock: () => (lockHeld ? false : (lockHeld = true)), releaseLock: () => (lockHeld = false) }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  Utilities: {
    sleep: () => {},
    formatDate: (d, tz, _pattern) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperties: () => ({ ...props }),
      getProperty: (k) => props[k] ?? null,
      setProperty: (k, v) => (props[k] = v),
      setProperties: (values) => Object.assign(props, values),
      deleteProperty: (k) => delete props[k],
    }),
  },
  UrlFetchApp: {
    fetch: (url, o = {}) => {
      const hit = canned(url)
      if (hit !== null) {
        const res = typeof hit === 'string' ? { headers: {}, body: hit } : hit
        return { getResponseCode: () => 200, getContentText: () => res.body, getAllHeaders: () => res.headers }
      }
      if (!url.startsWith('http://127.0.0.1')) throw new Error(`Unexpected URL in test: ${url}`)
      const args = ['-s', '-X', (o.method || 'get').toUpperCase(), '-H', 'Content-Type: application/json', '-w', '\n%{http_code}']
      if (o.headers?.Authorization) args.push('-H', `Authorization: ${o.headers.Authorization}`)
      if (o.payload) args.push('-d', o.payload)
      const out = execFileSync('curl', [...args, url], { encoding: 'utf8' })
      const at = out.lastIndexOf('\n')
      return { getResponseCode: () => Number(out.slice(at + 1)), getContentText: () => out.slice(0, at), getAllHeaders: () => ({}) }
    },
  },
})
runInContext(readFileSync('scripts/market-scanner/market-scanner.gs', 'utf8'), sandbox)

function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`ok: ${msg}`)
}

// Clean slate: steve follows a stock and holds two; wife follows one. No scanner docs yet.
for (const uid of ['steve', 'wife']) {
  await admin.doc(`investing/${uid}/data/summary`).delete()
  await admin.doc(`investing/${uid}/data/watchlist`).delete()
}
await admin.doc('investing/steve').set({ symbols: ['NVDA'], positions: [{ symbol: 'AAPL', qty: 12, paid: 155.21 }] })
await admin.doc('investing/wife').set({ symbols: ['FLAT'], positions: [] })

// A few runs: build the universe, then scan, then analyze and publish. Each run is one slice.
for (let run = 0; run < 6; run++) {
  sandbox.scan()
  if ((await admin.doc('investing/steve/data/watchlist').get()).exists) break
}

const summary = (await admin.doc('investing/steve/data/summary').get()).data()
check(summary && summary.holdings.length === 2, "steve's summary covers his typed symbol and his position")
check(summary.holdings.every((h) => h.price > 0 && Array.isArray(h.flags)), 'every holding has a price and flags')
check(summary.holdings.every((h) => h.news.length > 0), 'every holding has headlines')

const wifeSummary = (await admin.doc('investing/wife/data/summary').get()).data()
check(wifeSummary && wifeSummary.holdings.length === 1 && wifeSummary.holdings[0].symbol === 'FLAT', "wife's summary has her own stock only")

const watchlist = (await admin.doc('investing/steve/data/watchlist').get()).data()
check(watchlist, 'the watchlist was published')
check(watchlist.universe === 2, 'the universe holds the two mid-caps (the mega-cap and the unit are screened out)')
const xyz = watchlist.candidates.find((c) => c.symbol === 'XYZ')
check(xyz, 'XYZ (down 27% post-earnings, fundamentals intact) is a candidate')
check(!watchlist.candidates.some((c) => c.symbol === 'FLAT'), 'FLAT (no drop) is not')
check(xyz.facts.revenueGrowth === 18 && xyz.facts.netDebtToEbitda === 0.5 && xyz.facts.insiderBuys90d === 2, "XYZ's facts match the filings")
check(xyz.score >= 60 && xyz.parts.sentiment === 5, 'XYZ scores above the floor, with neutral sentiment (no Gemini key)')
check(xyz.report.includes('not investment advice'), 'the report carries the disclaimer')
const wifeWatchlist = (await admin.doc('investing/wife/data/watchlist').get()).data()
check(wifeWatchlist && wifeWatchlist.candidates.length === watchlist.candidates.length, 'every member gets the watchlist')

// A second pass reuses the universe and publishes again without rebuilding.
const buildsBefore = Object.keys(props).filter((k) => k.startsWith('SCAN_STATE')).length
for (let run = 0; run < 4; run++) sandbox.scan()
check(Object.keys(props).filter((k) => k.startsWith('SCAN_STATE')).length >= 1 && buildsBefore >= 1, 'scanner state persists between runs')

await admin.doc('investing/wife').delete()
await admin.doc('investing/wife/data/summary').delete()
await admin.doc('investing/wife/data/watchlist').delete()
console.log('\nAll market scanner emulator checks passed.')
process.exit(0)
