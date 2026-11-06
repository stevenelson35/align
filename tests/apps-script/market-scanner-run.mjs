// Runs the real market scanner Apps Script against the local emulators, with canned market data standing in for
// Yahoo, Nasdaq Trader and Google News. Needs `npm run emulators` and `npm run seed` first. Usage: npm run test:scanner
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
  AUTH_URL: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'http://127.0.0.1:8080/v1',
}

// ---- Canned market data ----
// XYZ: a $8.2B mid-cap down 27% in 5 days right after reporting, growing, cash-flowing, insiders buying → a candidate.
// FLAT: a $5B mid-cap that didn't move → screened out at stage 1. BIG: $900B → not in the universe.
const chart = (closes, volumes, timestamps) => ({
  chart: { result: [{ timestamp: timestamps ?? closes.map((_, i) => 1700000000 + i * 86400), indicators: { quote: [{ close: closes, volume: volumes ?? closes.map(() => 2e6) }] }, meta: { shortName: 'Chart Co' } }] },
})
const steady = (price) => chart(Array.from({ length: 30 }, () => price))
const dropped = chart([...Array.from({ length: 24 }, () => 34.5), 34.5, 30, 28, 26, 25.4, 25.1]) // −27.2% over 5 trading days
const raw = (v) => ({ raw: v })
const xyzSummary = {
  price: { shortName: 'XYZ Corp' },
  financialData: { revenueGrowth: raw(0.18), freeCashflow: raw(360e6), totalRevenue: raw(4000e6), totalDebt: raw(700e6), totalCash: raw(450e6), ebitda: raw(500e6) },
  defaultKeyStatistics: { trailingEps: raw(2.5), forwardPE: raw(8) },
  netSharePurchaseActivity: { buyInfoCount: raw(2), period: '6m' },
  // Yahoo schedules the next earnings ~a quarter after a report: 89 days out ≈ reported two days ago.
  calendarEvents: { earnings: { earningsDate: [raw(Math.floor(Date.now() / 1000) + 89 * 86400)] } },
}
const nasdaqListed = [
  'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',
  'XYZ|XYZ Corp - Common Stock|Q|N|N|100|N|N',
  'FLAT|Flat Co - Common Stock|Q|N|N|100|N|N',
  'SPYY|Some ETF|G|N|N|100|Y|N',
].join('\r\n')
const otherListed = [
  'ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol',
  'BIG|Big Co Common Stock|N|BIG|N|100|N|BIG',
  'File Creation Time: 1105202603:02||||||',
].join('\r\n')
const rss = '<rss><channel><item><title><![CDATA[XYZ tumbles on guidance]]></title><link>https://example.com/xyz</link></item></channel></rss>'
let valuationFailure = false
let statusWriteFailure = false
let analysisFailure = false
const screeningRequests = []

const canned = (url) => {
  if (url.includes('nasdaqlisted.txt')) return nasdaqListed
  if (url.includes('otherlisted.txt')) return otherListed
  if (url.includes('fc.yahoo.com')) return { headers: { 'Set-Cookie': 'A3=test; Path=/' }, body: '' }
  if (url.includes('getcrumb')) return 'test-crumb'
  if (url.includes('/v7/finance/quote')) return JSON.stringify({ quoteResponse: { result: [{ symbol: 'XYZ', marketCap: 8.2e9 }, { symbol: 'FLAT', marketCap: 5e9 }, { symbol: 'BIG', marketCap: 900e9 }] } })
  if (url.includes('/v10/finance/quoteSummary/XYZ')) return analysisFailure ? { code: 429, body: 'Too Many Requests', headers: {} } : JSON.stringify({ quoteSummary: { result: [xyzSummary] } })
  if (url.includes('/v10/finance/quoteSummary/KMB')) {
    check(url.includes('summaryDetail'), 'the valuation request includes summaryDetail')
    return valuationFailure ? { code: 429, body: 'Too Many Requests', headers: {} } : JSON.stringify({ quoteSummary: { result: [{ summaryDetail: { trailingPE: raw(18.4), forwardPE: raw(16.2) } }] } })
  }
  if (url.includes('/v10/finance/quoteSummary/')) return JSON.stringify({ quoteSummary: { result: [{}] } })
  if (url.includes('/v8/finance/chart/XYZ')) return JSON.stringify(dropped)
  if (url.includes('/v8/finance/chart/')) return JSON.stringify(steady(100))
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
        return { getResponseCode: () => res.code ?? 200, getContentText: () => res.body, getAllHeaders: () => res.headers }
      }
      if (statusWriteFailure && o.payload?.includes('/data/status')) {
        return { getResponseCode: () => 503, getContentText: () => 'Test status write failure', getAllHeaders: () => ({}) }
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
const originalCloses = sandbox.dailyCloses_
sandbox.dailyCloses_ = (symbol, range, interval) => {
  if (!range) screeningRequests.push(symbol)
  if (symbol === 'BROKEN') throw new Error('Test missing price data')
  return originalCloses(symbol, range, interval)
}

function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`ok: ${msg}`)
}

// Dedicated fixture ids keep the legacy case valid even after browsing has migrated the seeded members.
const fixtureLists = ['holdings_scanner-test-steve', 'scanner-test-second', 'overreactions_scanner-test-steve']
async function clearFixtures() {
  for (const path of ['investing/scanner-test-steve', 'investing/scanner-test-wife', ...fixtureLists.map((id) => `investmentLists/${id}`)]) {
    for (const kind of ['summary', 'watchlist', 'status']) await admin.doc(`${path}/data/${kind}`).delete()
    await admin.doc(path).delete()
  }
}
await clearFixtures()
await admin.doc('investing/scanner-test-steve').set({ symbols: ['NVDA'], positions: [{ symbol: 'AAPL', qty: 12, paid: 155.21 }] })
await admin.doc('investing/scanner-test-wife').set({ symbols: ['FLAT'], positions: [] })

// A few runs: build the universe, then scan, then analyze and publish. Each run is one slice.
for (let run = 0; run < 6; run++) {
  sandbox.scan()
  if ((await admin.doc('investing/scanner-test-steve/data/watchlist').get()).exists) break
}

const summary = (await admin.doc('investing/scanner-test-steve/data/summary').get()).data()
check(summary && summary.holdings.length === 2, "steve's summary covers his typed symbol and his position")
check(summary.holdings.every((h) => h.price > 0 && Array.isArray(h.flags)), 'every holding has a price and flags')
check(summary.holdings.every((h) => h.news.length > 0), 'every holding has headlines')

const wifeSummary = (await admin.doc('investing/scanner-test-wife/data/summary').get()).data()
check(wifeSummary && wifeSummary.holdings.length === 1 && wifeSummary.holdings[0].symbol === 'FLAT', "wife's summary has her own stock only")

const watchlist = (await admin.doc('investing/scanner-test-steve/data/watchlist').get()).data()
check(watchlist, 'the watchlist was published')
check(watchlist.universe === 2, 'the universe holds the two mid-caps (the mega-cap and the ETF are screened out)')
const xyz = watchlist.candidates.find((c) => c.symbol === 'XYZ')
check(xyz, 'XYZ (down 27% post-earnings, fundamentals intact) is a candidate')
check(!watchlist.candidates.some((c) => c.symbol === 'FLAT'), 'FLAT (no drop) is not')
check(xyz.facts.revenueGrowth === 18 && xyz.facts.netDebtToEbitda === 0.5 && xyz.facts.insiderBuys6m === 2 && xyz.facts.peForward === 8, "XYZ's facts match Yahoo's fundamentals")
check(xyz.score >= 60 && xyz.parts.sentiment === 5, 'XYZ scores above the floor, with neutral sentiment (no Gemini key)')
check(xyz.report.includes('not investment advice'), 'the report carries the disclaimer')
const wifeWatchlist = (await admin.doc('investing/scanner-test-wife/data/watchlist').get()).data()
check(wifeWatchlist && wifeWatchlist.candidates.length === watchlist.candidates.length, 'every member gets the watchlist')

// New multi-list installations retain the scanner cursor, but route outputs to each individual parent.
const privacy = { ownerId: 'scanner-test-steve', visibility: 'private', viewerVisible: false }
await admin.doc('investmentLists/holdings_scanner-test-steve').set({ ...privacy, name: 'My investments', kind: 'holdings', symbols: ['XYZ'], positions: [] })
await admin.doc('investmentLists/scanner-test-second').set({ ...privacy, name: 'Research', kind: 'holdings', symbols: ['FLAT'], positions: [] })
await admin.doc('investmentLists/overreactions_scanner-test-steve').set({ ...privacy, name: 'Overreactions', kind: 'overreactions', symbols: [], positions: [] })
sandbox.scan()
const firstList = (await admin.doc('investmentLists/holdings_scanner-test-steve/data/summary').get()).data()
const secondList = (await admin.doc('investmentLists/scanner-test-second/data/summary').get()).data()
check(firstList.holdings.length === 1 && firstList.holdings[0].symbol === 'XYZ', 'first list has only its own stock')
check(firstList.holdings[0].peForward === 8, 'holdings include forward P/E')
check(secondList.holdings.length === 1 && secondList.holdings[0].symbol === 'FLAT', 'second list is independent')
check((await admin.doc('investmentLists/overreactions_scanner-test-steve/data/watchlist').get()).data().candidates.length === watchlist.candidates.length, 'overreactions has its own output')
check(!(await admin.doc('investmentLists/scanner-test-second/data/watchlist').get()).exists, 'no overreactions written into a holdings list')
const completedStatus = (await admin.doc('investmentLists/overreactions_scanner-test-steve/data/status').get()).data()
check(completedStatus.stage === 'completed' && completedStatus.lastPass.screened === 2 && completedStatus.lastPass.kept === 1, 'status records the completed pass and work performed')
check(completedStatus.lastRun.finishedAt && completedStatus.lastRun.work.screened === 2, 'last slice has completion time and price-check count')

// A second pass reuses the universe and publishes again without rebuilding.
const buildsBefore = Object.keys(props).filter((k) => k.startsWith('SCAN_STATE')).length
for (let run = 0; run < 4; run++) sandbox.scan()
check(Object.keys(props).filter((k) => k.startsWith('SCAN_STATE')).length >= 1 && buildsBefore >= 1, 'scanner state persists between runs')

// Upgrade an actual pre-telemetry checkpoint: status publication must not change a single state-property byte.
const scriptProps = sandbox.PropertiesService.getScriptProperties()
const checkpoint = {
  universe: [['XYZ', 8.2e9], ['FLAT', 5e9]], universeAt: new Date().toISOString(), cursor: 1,
  passers: [{ symbol: 'XYZ', cap: 8.2e9, drop5d: -27, price: 25.1 }], scored: [], watchlistAt: '2026-11-01',
}
sandbox.stateSave_(scriptProps, checkpoint)
const savedState = () => JSON.stringify(Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('SCAN_STATE'))))
const beforeStatus = savedState()
sandbox.scanStatus()
check(savedState() === beforeStatus, 'scanStatus publishes saved progress without changing SCAN_STATE')
const snapshot = (await admin.doc('investmentLists/overreactions_scanner-test-steve/data/status').get()).data()
check(snapshot.execution === 'snapshot' && snapshot.screened === 1 && snapshot.queued === 1, 'pre-upgrade cursor and pending candidates appear in Align status')
screeningRequests.length = 0
sandbox.scan()
check(JSON.stringify(screeningRequests) === JSON.stringify(['FLAT']), 'the next upgraded scan resumes at the old cursor instead of rescanning XYZ')
const resumed = sandbox.stateLoad_(scriptProps)
check(resumed.universeAt === checkpoint.universeAt && resumed.lastPass.kept === 1, 'the preserved candidate is scored and published without rebuilding the universe')

const kmb = sandbox.holdingFor_('KMB')
check(kmb.peTrailing === 18.4 && kmb.peForward === 16.2 && kmb.valuationCheckedAt, 'holdings P/E works when Yahoo supplies ratios only in summaryDetail')
valuationFailure = true
const failedKmb = sandbox.holdingFor_('KMB')
check(failedKmb.price > 0 && failedKmb.valuationError.includes('429'), 'rate-limited valuation is explicit without hiding available price data')
valuationFailure = false

sandbox.stateSave_(scriptProps, checkpoint)
statusWriteFailure = true
let failed = false
try { sandbox.scan() } catch (e) { failed = e.message.includes('503') }
statusWriteFailure = false
check(failed && sandbox.stateLoad_(scriptProps).cursor === 1 && sandbox.stateLoad_(scriptProps).passers.length === 1, 'failed telemetry writes surface an error and preserve the in-flight pass')

sandbox.stateSave_(scriptProps, { ...checkpoint, universe: [['BROKEN', 5e9]], cursor: 0 })
analysisFailure = true
sandbox.scan()
analysisFailure = false
const failedPass = (await admin.doc('investmentLists/overreactions_scanner-test-steve/data/status').get()).data()
check(failedPass.lastRun.work.priceErrors === 1 && failedPass.lastRun.work.analysisErrors === 1 && failedPass.lastPass.stats.analysisErrors === 1, 'completed status distinguishes failed lookups from stocks rejected by the screen')

const deferredWrites = []
sandbox.summarize_({ set: (path) => deferredWrites.push(path) }, [{ id: 'deferred', fields: { symbols: ['XYZ'] } }], { TIME_ZONE: 'America/New_York' }, () => false)
check(deferredWrites.length === 0, 'an exhausted run budget never overwrites a holdings summary with partial or empty data')

await clearFixtures()
console.log('\nAll market scanner emulator checks passed.')
process.exit(0)
