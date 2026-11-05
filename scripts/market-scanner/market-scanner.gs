/**
 * Align: market scanner (DESIGN.md §5.13).
 *
 * Runs in Google Apps Script (free) and writes to Firestore as the household's helper account ("bot"), so the normal
 * security rules apply. For every member with an Investing doc (investing/{uid}: their symbols and positions, entered
 * in Align) it keeps two documents under investing/{uid}/data:
 *
 *   summary    — today's look at their own stocks: price, day / week change, 52-week range, news headlines, and
 *                flags on anything that moved a lot (a nudge to look closer, never advice).
 *   watchlist  — the post-earnings dislocation screen: quality mid-caps that just fell much more than the business
 *                did. A three-stage funnel: (1) price dropped 15–40% in 5 days on real volume, (2) fundamentals from
 *                SEC EDGAR (revenue still growing, free cash flow positive, manageable debt, insiders buying),
 *                (3) a 0–100 score and, with a free Gemini API key, a one-page report (why it fell, bull / bear
 *                case, historical analogs, a recovery estimate).
 *
 * Everything is free: prices from Yahoo Finance's public chart endpoint (Stooq as fallback), fundamentals and insider
 * buying from SEC EDGAR's official APIs, headlines from Google News RSS, and the write-up from the Gemini API's free
 * tier. The 6-minute execution limit is handled by scanning in slices: each run picks up where the last one left off
 * (state in Script Properties), so a full pass over the universe takes a day or two — fine, since the screen looks
 * for drops that happened over the last 5 trading days.
 *
 * Setup (see scripts/market-scanner/README.md). Script properties:
 *   FIREBASE_API_KEY     the web app's apiKey
 *   FIREBASE_PROJECT_ID  align-a32c1
 *   BOT_EMAIL            the helper account's Firebase Auth email (the calendar bot works)
 *   BOT_PASSWORD         its password
 *   EDGAR_CONTACT        how the SEC can reach you, e.g. "Align scanner you@example.com" (they require this header)
 *   GEMINI_API_KEY       optional: a free key from https://aistudio.google.com → the AI report and sentiment score
 * Optional tuning (defaults in brackets):
 *   GEMINI_MODEL (gemini-2.5-flash), MIN_CAP_B (2), MAX_CAP_B (50), MIN_DROP (15), MAX_DROP (40),
 *   MIN_DOLLAR_VOL_M (10), MIN_SCORE (60), EARNINGS_DAYS (10), SCAN_BATCH (200), CUSTOM_UNIVERSE (tickers,comma,separated)
 * Then run installTrigger() once.
 *
 * This is a research helper, not investment advice. It surfaces things to read about; it never trades.
 */

var MAX_RUN_MS = 4.5 * 60000 // leave headroom under the 6-minute execution limit
var UNIVERSE_DAYS = 7 // rebuild the ticker universe (market caps drift) this often
var INSIDER_DAYS = 90
var FORM4_FETCH_LIMIT = 5 // how many recent Form 4 filings to read per candidate
var CANDIDATES_KEPT = 10

var DEFAULTS = {
  AUTH_URL: 'https://identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'https://firestore.googleapis.com/v1',
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta',
  GEMINI_MODEL: 'gemini-2.5-flash',
  MIN_CAP_B: '2',
  MAX_CAP_B: '50',
  MIN_DROP: '15',
  MAX_DROP: '40',
  MIN_DOLLAR_VOL_M: '10',
  MIN_SCORE: '60',
  EARNINGS_DAYS: '10',
  SCAN_BATCH: '200',
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Run once from the editor: replaces any existing trigger with one every 4 hours, then runs a first slice. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      return t.getHandlerFunction() === 'scan'
    })
    .forEach(function (t) {
      ScriptApp.deleteTrigger(t)
    })
  ScriptApp.newTrigger('scan').timeBased().everyHours(4).create()
  scan()
}

/** The trigger's entry point: one scan slice at a time. */
function scan() {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) throw new Error('Another scan is still running.')
  try {
    return scan_()
  } finally {
    lock.releaseLock()
  }
}

/** Starts the whole scan over (fresh universe, fresh pass). */
function resetScanner() {
  stateSave_(PropertiesService.getScriptProperties(), {})
  Logger.log('Scanner state cleared; the next run rebuilds the universe.')
}

/** Where things stand (look in Executions, or run from the editor). */
function scanStatus() {
  var state = stateLoad_(PropertiesService.getScriptProperties())
  Logger.log(
    'Universe: %s tickers (built %s). Pass cursor: %s. Stage-1 passers waiting: %s. Scored: %s. Last watchlist: %s.',
    (state.universe || []).length,
    state.universeAt || 'never',
    state.cursor || 0,
    (state.passers || []).length,
    (state.scored || []).length,
    state.watchlistAt || 'never',
  )
}

// ---------------------------------------------------------------------------
// The scan: summaries every run; universe → stage 1 → stage 2/3 in slices
// ---------------------------------------------------------------------------

function scan_() {
  var started = Date.now()
  var props = PropertiesService.getScriptProperties()
  var cfg = scanConfig_(props.getProperties())
  var api = firestoreApi_(cfg, signIn_(cfg))
  var users = api.all('investing')
  if (!users.length) {
    Logger.log('No one has set up Investing in Align yet (no investing/{uid} docs); nothing to do.')
    return
  }
  var state = stateLoad_(props)
  var budget = function () {
    return Date.now() - started < MAX_RUN_MS
  }

  // 1. Today's summary of each member's own stocks (every run, so prices stay fresh).
  summarize_(api, users, cfg)

  // 2. The ticker universe: mid-caps worth scanning, rebuilt weekly. Built in slices too (market caps come from
  //    batch quotes, ~80 tickers a call over the whole US market).
  if (universeStale_(state, cfg)) {
    buildUniverseStep_(state, cfg, budget)
    stateSave_(props, state)
    if (universeStale_(state, cfg)) return // keep building next run
  }

  // 3. Stage 1 over the universe: 5-day drop on real dollar volume. A slice per run.
  var universe = state.universe || []
  state.cursor = state.cursor || 0
  state.passers = state.passers || []
  state.scored = state.scored || []
  var batch = 0
  while (state.cursor < universe.length && batch < cfg.SCAN_BATCH && budget()) {
    var row = universe[state.cursor] // [symbol, cik, marketCap]
    state.cursor++
    batch++
    try {
      var bars = dailyCloses_(row[0])
      var check = {
        drop5d: drop5d_(bars.closes),
        dollarVol: avgDollarVol_(bars.closes, bars.volumes),
        marketCap: row[2],
      }
      if (stage1Pass_(check, cfg)) {
        state.passers.push({ symbol: row[0], cik: row[1], cap: row[2], drop5d: check.drop5d, price: bars.closes[bars.closes.length - 1] })
        Logger.log('Stage 1: %s fell %s%% in 5 days.', row[0], Math.round(check.drop5d))
      }
    } catch (e) {
      // One dead ticker shouldn't stop the pass.
    }
    Utilities.sleep(120)
  }

  // 4. Stage 2 + 3 for the passers (a handful): fundamentals, insiders, score, report. Then publish.
  if (state.cursor >= universe.length) {
    while (state.passers.length && budget()) {
      var p = state.passers.shift()
      try {
        var candidate = analyze_(p, cfg)
        if (candidate) state.scored.push(candidate)
      } catch (e) {
        Logger.log('Analyzing %s failed: %s', p.symbol, e && e.message)
      }
    }
    if (!state.passers.length) {
      publishWatchlist_(api, users, state, cfg)
      state.cursor = 0
      state.scored = []
      state.watchlistAt = today_(cfg)
    }
  }
  stateSave_(props, state)
  Logger.log('Slice done: cursor %s/%s, %s passers waiting, %s scored.', state.cursor, universe.length, state.passers.length, (state.scored || []).length)
}

// ---------------------------------------------------------------------------
// Summaries: each member's own stocks
// ---------------------------------------------------------------------------

function summarize_(api, users, cfg) {
  var cache = {} // symbol → holding, shared across members
  var day = today_(cfg)
  users.forEach(function (u) {
    var symbols = symbolsOf_(u.fields)
    if (!symbols.length) return
    var holdings = []
    symbols.slice(0, 100).forEach(function (symbol) {
      if (!cache[symbol]) {
        try {
          cache[symbol] = holdingFor_(symbol)
        } catch (e) {
          cache[symbol] = { symbol: symbol, flags: [], news: [] }
        }
        Utilities.sleep(120)
      }
      holdings.push(cache[symbol])
    })
    api.set('investing/' + u.id + '/data/summary', { day: day, generatedAt: new Date().toISOString(), holdings: holdings })
  })
}

/** Today's numbers, flags and headlines for one stock. */
function holdingFor_(symbol) {
  var bars = dailyCloses_(symbol, '1y')
  var closes = bars.closes
  var n = closes.length
  var h = {
    symbol: symbol,
    name: bars.name || symbol,
    price: round2_(closes[n - 1]),
    change1d: n >= 2 ? round2_(pctChange_(closes[n - 2], closes[n - 1])) : null,
    change5d: n >= 6 ? round2_(pctChange_(closes[n - 6], closes[n - 1])) : null,
    low52: round2_(Math.min.apply(null, closes)),
    high52: round2_(Math.max.apply(null, closes)),
  }
  h.flags = holdingFlags_(h)
  h.news = news_(symbol).slice(0, 3)
  return h
}

/** investing/{uid} fields → every symbol to follow (typed ones plus held ones). */
function symbolsOf_(fields) {
  var out = []
  ;(fields.symbols || []).concat((fields.positions || []).map(function (p) {
    return p && p.symbol
  })).forEach(function (s) {
    if (s && out.indexOf(s) < 0) out.push(s)
  })
  return out
}

// ---------------------------------------------------------------------------
// The universe: US mid-caps from EDGAR's ticker list + batch market caps
// ---------------------------------------------------------------------------

function universeStale_(state, cfg) {
  if (!state.universe || !state.universe.length) return true
  var age = (Date.now() - new Date(state.universeAt).getTime()) / 86400000
  return !(age < UNIVERSE_DAYS)
}

/** One slice of the rebuild: first the ticker/CIK list, then market caps batch by batch. */
function buildUniverseStep_(state, cfg, budget) {
  if (cfg.CUSTOM_UNIVERSE) {
    // A hand-kept list skips the market-cap screen (caps unknown → every name passes that filter).
    state.universe = cfg.CUSTOM_UNIVERSE.split(',').map(function (s) {
      return [s.trim().toUpperCase(), null, null]
    })
    state.universeAt = new Date().toISOString()
    state.cursor = 0
    return
  }
  if (!state.tickers) {
    var listed = edgarJson_('https://www.sec.gov/files/company_tickers.json', cfg)
    var tickers = []
    Object.keys(listed).forEach(function (k) {
      var t = listed[k]
      // Plain common stock only: unit / warrant / preferred tickers carry a dash.
      if (t.ticker && t.ticker.indexOf('-') < 0) tickers.push([t.ticker, t.cik_str])
    })
    state.tickers = tickers
    state.tickCursor = 0
    state.newUniverse = []
    Logger.log('Universe rebuild: %s listed tickers to size up.', tickers.length)
    return
  }
  while (state.tickCursor < state.tickers.length && budget()) {
    var slice = state.tickers.slice(state.tickCursor, state.tickCursor + 80)
    state.tickCursor += slice.length
    try {
      var quotes = yahooQuotes_(slice.map(function (t) {
        return t[0]
      }))
      slice.forEach(function (t) {
        var cap = quotes[t[0]]
        if (cap && cap >= cfg.MIN_CAP && cap <= cfg.MAX_CAP) state.newUniverse.push([t[0], t[1], cap])
      })
    } catch (e) {
      Logger.log('Quote batch failed (%s); will retry next run.', e && e.message)
      state.tickCursor -= slice.length
      return
    }
    Utilities.sleep(300)
  }
  if (state.tickCursor >= state.tickers.length) {
    state.universe = state.newUniverse
    state.universeAt = new Date().toISOString()
    state.cursor = 0
    state.passers = []
    delete state.tickers
    delete state.tickCursor
    delete state.newUniverse
    Logger.log('Universe ready: %s mid-caps ($%sB–$%sB).', state.universe.length, cfg.MIN_CAP / 1e9, cfg.MAX_CAP / 1e9)
  }
}

// ---------------------------------------------------------------------------
// Stages 2 and 3: EDGAR fundamentals, insiders, score, AI report
// ---------------------------------------------------------------------------

/** A stage-1 passer → a scored candidate, or null (no recent earnings filing, or numbers missing). */
function analyze_(p, cfg) {
  var cik = p.cik
  if (!cik) cik = cikFor_(p.symbol, cfg)
  if (!cik) return null
  var subs = edgarJson_('https://data.sec.gov/submissions/CIK' + padCik_(cik) + '.json', cfg)
  var recent = (subs && subs.filings && subs.filings.recent) || {}
  // Stage 1 asked "did it fall"; here: did it fall *because of earnings* (a results filing in the window)?
  if (!postEarnings_(recent, cfg.EARNINGS_DAYS)) return null
  var buys = insiderBuys_(cik, recent, cfg)
  var facts = null
  try {
    var cf = edgarJson_('https://data.sec.gov/api/xbrl/companyfacts/CIK' + padCik_(cik) + '.json', cfg)
    var years = yearlyAverages_(dailyCloses_(p.symbol, '10y', '1mo'))
    facts = factsFrom_(cf, p.price, years)
  } catch (e) {
    return null // no XBRL facts, no candidate
  }
  facts.insiderBuys90d = buys
  var headlines = news_(p.symbol).slice(0, 5)
  var ai = { sentiment: 5, recovery: null, report: '' }
  if (cfg.GEMINI_API_KEY && scoreCandidate_({ revenueGrowth: facts.revenueGrowth, fcf: facts.fcf, fcfMargin: facts.fcfMargin, netDebtToEbitda: facts.netDebtToEbitda, pe: facts.pe, peAvg10y: facts.peAvg10y, insiderBuys90d: buys, sentiment: 10 }).score >= cfg.MIN_SCORE) {
    ai = gemini_(cfg, reportPrompt_({ symbol: p.symbol, name: subs.name || p.symbol, drop5d: p.drop5d, price: p.price, marketCap: p.cap, facts: facts }, headlines))
  }
  facts.sentiment = ai.sentiment
  var scored = scoreCandidate_(facts)
  if (scored.score < cfg.MIN_SCORE) return null
  return {
    symbol: p.symbol,
    name: subs.name || p.symbol,
    score: scored.score,
    parts: scored.parts,
    price: round2_(p.price),
    drop5d: round2_(p.drop5d),
    marketCap: p.cap,
    facts: cleanFacts_(facts),
    recovery: ai.recovery,
    report: (ai.report ? ai.report + '\n\n' : '') + 'This is an automated research note, not investment advice.',
    headlines: headlines,
  }
}

/** A results filing (10-Q, 10-K or 8-K) within the last n days. */
function postEarnings_(recent, days) {
  var forms = recent.form || []
  var dates = recent.filingDate || []
  var cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  for (var i = 0; i < forms.length; i++) {
    if (dates[i] < cutoff) break // newest first
    if (forms[i] === '10-Q' || forms[i] === '10-K' || forms[i] === '8-K') return true
  }
  return false
}

/** Open-market insider purchases in the last 90 days: read the most recent Form 4s and count "P" transactions. */
function insiderBuys_(cik, recent, cfg) {
  var forms = recent.form || []
  var dates = recent.filingDate || []
  var accession = recent.accessionNumber || []
  var docs = recent.primaryDocument || []
  var cutoff = new Date(Date.now() - INSIDER_DAYS * 86400000).toISOString().slice(0, 10)
  var buys = 0
  var read = 0
  for (var i = 0; i < forms.length && read < FORM4_FETCH_LIMIT; i++) {
    if (dates[i] < cutoff) break
    if (forms[i] !== '4') continue
    read++
    try {
      var url = 'https://www.sec.gov/Archives/edgar/data/' + Number(cik) + '/' + accession[i].replace(/-/g, '') + '/' + docs[i]
      buys += form4Buys_(edgarText_(url, cfg))
      Utilities.sleep(150)
    } catch (e) {
      // Skip a filing that won't load.
    }
  }
  return buys
}

/** The symbol's CIK when a custom universe didn't carry one. */
function cikFor_(symbol, cfg) {
  var listed = edgarJson_('https://www.sec.gov/files/company_tickers.json', cfg)
  var keys = Object.keys(listed)
  for (var i = 0; i < keys.length; i++) {
    if (listed[keys[i]].ticker === symbol) return listed[keys[i]].cik_str
  }
  return null
}

function publishWatchlist_(api, users, state, cfg) {
  var candidates = (state.scored || [])
    .sort(function (a, b) {
      return b.score - a.score
    })
    .slice(0, CANDIDATES_KEPT)
  var doc = {
    day: today_(cfg),
    scannedAt: new Date().toISOString(),
    universe: (state.universe || []).length,
    scanned: (state.universe || []).length,
    candidates: candidates,
    note: candidates.length ? '' : 'The last pass found no post-earnings dislocations that cleared the screen — most passes don’t.',
  }
  users.forEach(function (u) {
    api.set('investing/' + u.id + '/data/watchlist', doc)
  })
  Logger.log('Watchlist published: %s candidates for %s member(s).', candidates.length, users.length)
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested from tests/apps-script/market-scanner.test.ts)
// ---------------------------------------------------------------------------

function pctChange_(from, to) {
  return from ? ((to - from) / Math.abs(from)) * 100 : 0
}

/** The 5-trading-day percent change, from a series of daily closes (newest last). */
function drop5d_(closes) {
  var n = closes.length
  return n >= 6 ? pctChange_(closes[n - 6], closes[n - 1]) : null
}

/** Average daily dollar volume over the series. */
function avgDollarVol_(closes, volumes) {
  var sum = 0
  var days = 0
  for (var i = 0; i < closes.length; i++) {
    if (closes[i] && volumes[i]) {
      sum += closes[i] * volumes[i]
      days++
    }
  }
  return days ? sum / days : 0
}

/** Stage 1: fell hard (but not into the abyss), trades real money, sized in the sweet spot. */
function stage1Pass_(c, cfg) {
  if (c.drop5d === null || c.drop5d > -cfg.MIN_DROP || c.drop5d < -cfg.MAX_DROP) return false
  if (!(c.dollarVol > cfg.MIN_DOLLAR_VOL)) return false
  if (c.marketCap !== null && c.marketCap !== undefined && (c.marketCap < cfg.MIN_CAP || c.marketCap > cfg.MAX_CAP)) return false
  return true
}

/** Monthly bars over ten years → the average close per calendar year (for the historical P/E). */
function yearlyAverages_(bars) {
  var byYear = {}
  for (var i = 0; i < bars.closes.length; i++) {
    if (!bars.closes[i] || !bars.timestamps[i]) continue
    var year = new Date(bars.timestamps[i] * 1000).getUTCFullYear()
    ;(byYear[year] = byYear[year] || []).push(bars.closes[i])
  }
  var out = {}
  Object.keys(byYear).forEach(function (y) {
    out[y] = byYear[y].reduce(function (a, b) {
      return a + b
    }, 0) / byYear[y].length
  })
  return out
}

function durationDays_(e) {
  return e.start && e.end ? Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 86400000) : null
}

/** XBRL entries → one value per quarter end (re-filings overwrite; sorted oldest → newest). */
function quarterly_(entries) {
  return dedupeByEnd_(entries, 70, 100)
}

/** XBRL entries → one value per fiscal year end. */
function annual_(entries) {
  return dedupeByEnd_(entries, 340, 380)
}

function dedupeByEnd_(entries, minDays, maxDays) {
  var byEnd = {}
  entries.forEach(function (e) {
    var d = durationDays_(e)
    if (d === null || d < minDays || d > maxDays) return
    byEnd[e.end] = e.val
  })
  return Object.keys(byEnd)
    .sort()
    .map(function (end) {
      return { end: end, val: byEnd[end] }
    })
}

/** Balance-sheet (instant) entries → the latest value. */
function latestInstant_(entries) {
  var best = null
  entries.forEach(function (e) {
    if (e.start) return
    if (!best || e.end > best.end) best = e
  })
  return best ? best.val : null
}

/** The first us-gaap tag that has values in this unit. */
function seriesFor_(cf, tags, unit) {
  var gaap = (cf && cf.facts && cf.facts['us-gaap']) || {}
  for (var i = 0; i < tags.length; i++) {
    var entries = gaap[tags[i]] && gaap[tags[i]].units && gaap[tags[i]].units[unit]
    if (entries && entries.length) return entries
  }
  return []
}

/** Latest quarter vs the same quarter a year earlier (within a 20-day tolerance), as a percent. */
function revenueGrowth_(quarters) {
  if (quarters.length < 2) return null
  var last = quarters[quarters.length - 1]
  var target = new Date(last.end).getTime() - 365 * 86400000
  var best = null
  quarters.forEach(function (q) {
    var gap = Math.abs(new Date(q.end).getTime() - target)
    if (gap <= 20 * 86400000 && (!best || gap < best.gap)) best = { q: q, gap: gap }
  })
  return best && best.q.val ? round2_(pctChange_(best.q.val, last.val)) : null
}

var REVENUE_TAGS = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet']

/**
 * A company's EDGAR XBRL facts + the current price + yearly average prices → what the score needs.
 * Growth prefers the latest quarter year-over-year; cash flow and EBITDA use the latest fiscal year.
 */
function factsFrom_(cf, price, yearAvgPrices) {
  var revQ = quarterly_(seriesFor_(cf, REVENUE_TAGS, 'USD'))
  var revA = annual_(seriesFor_(cf, REVENUE_TAGS, 'USD'))
  var growth = revenueGrowth_(revQ)
  if (growth === null && revA.length >= 2) growth = round2_(pctChange_(revA[revA.length - 2].val, revA[revA.length - 1].val))

  var ocfA = annual_(seriesFor_(cf, ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], 'USD'))
  var capexA = annual_(seriesFor_(cf, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], 'USD'))
  var fcf = null
  if (ocfA.length) {
    var ocf = ocfA[ocfA.length - 1]
    var capex = 0
    capexA.forEach(function (c) {
      if (c.end === ocf.end) capex = c.val
    })
    if (!capex && capexA.length) capex = capexA[capexA.length - 1].val
    fcf = ocf.val - capex
  }
  var fcfMargin = fcf !== null && revA.length && revA[revA.length - 1].val ? round2_((fcf / revA[revA.length - 1].val) * 100) : null

  var debt = (latestInstant_(seriesFor_(cf, ['LongTermDebtNoncurrent', 'LongTermDebt'], 'USD')) || 0) + (latestInstant_(seriesFor_(cf, ['LongTermDebtCurrent', 'DebtCurrent'], 'USD')) || 0)
  var cash = (latestInstant_(seriesFor_(cf, ['CashAndCashEquivalentsAtCarryingValue'], 'USD')) || 0) + (latestInstant_(seriesFor_(cf, ['ShortTermInvestments'], 'USD')) || 0)
  var opIncA = annual_(seriesFor_(cf, ['OperatingIncomeLoss'], 'USD'))
  var daA = annual_(seriesFor_(cf, ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'Depreciation'], 'USD'))
  var netDebtToEbitda = null
  var netDebt = debt - cash
  if (netDebt <= 0) netDebtToEbitda = 0
  else if (opIncA.length) {
    var ebitda = opIncA[opIncA.length - 1].val + (daA.length ? daA[daA.length - 1].val : 0)
    if (ebitda > 0) netDebtToEbitda = round2_(netDebt / ebitda)
  }

  var epsEntries = seriesFor_(cf, ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')
  var epsQ = quarterly_(epsEntries)
  var epsA = annual_(epsEntries)
  var epsTtm = null
  if (epsQ.length >= 4) {
    epsTtm = 0
    epsQ.slice(-4).forEach(function (q) {
      epsTtm += q.val
    })
  } else if (epsA.length) epsTtm = epsA[epsA.length - 1].val
  var pe = price && epsTtm > 0 ? round2_(price / epsTtm) : null

  var peAvg10y = null
  if (yearAvgPrices && epsA.length) {
    var ratios = []
    epsA.slice(-10).forEach(function (y) {
      var avg = yearAvgPrices[new Date(y.end).getUTCFullYear()]
      if (avg && y.val > 0) ratios.push(avg / y.val)
    })
    if (ratios.length >= 4)
      peAvg10y = round2_(ratios.reduce(function (a, b) {
        return a + b
      }, 0) / ratios.length)
  }

  return { revenueGrowth: growth, fcf: fcf, fcfMargin: fcfMargin, netDebtToEbitda: netDebtToEbitda, pe: pe, peAvg10y: peAvg10y, epsTtm: epsTtm }
}

/** A Form 4 document → how many open-market purchases it reports (transaction code P). */
function form4Buys_(xml) {
  var buys = 0
  var re = /<transactionCode>\s*P\s*<\/transactionCode>/g
  while (re.exec(xml)) buys++
  return buys
}

/**
 * The 0–100 score: revenue growth 25, free cash flow 20, balance sheet 20, valuation vs history 15, insider
 * buying 10, sentiment 10 (the AI's read of the news; 5 = neutral without a key). Missing data lands mid-scale
 * rather than failing the stock.
 */
function scoreCandidate_(f) {
  var parts = {}
  parts.growth = f.revenueGrowth !== null && f.revenueGrowth !== undefined && f.revenueGrowth > 0 ? Math.min(25, Math.floor(f.revenueGrowth * 1.25)) : 0
  parts.fcf = f.fcf !== null && f.fcf !== undefined && f.fcf > 0 ? Math.max(4, Math.min(20, Math.floor((f.fcfMargin || 0) * 2))) : 0
  var nde = f.netDebtToEbitda
  parts.balance = nde === null || nde === undefined ? 10 : nde <= 0 ? 20 : nde < 1 ? 18 : nde < 2 ? 14 : nde < 3 ? 8 : 2
  parts.valuation = f.pe && f.peAvg10y ? (f.pe < f.peAvg10y ? Math.min(15, Math.floor((1 - f.pe / f.peAvg10y) * 30)) : 0) : 7
  var buys = f.insiderBuys90d || 0
  parts.insider = buys >= 2 ? 10 : buys === 1 ? 7 : 0
  var s = f.sentiment === null || f.sentiment === undefined ? 5 : f.sentiment
  parts.sentiment = Math.max(0, Math.min(10, Math.round(s)))
  var score = 0
  Object.keys(parts).forEach(function (k) {
    score += parts[k]
  })
  return { score: score, parts: parts }
}

/** Flags on a summary holding: moves worth a look (thresholds: 5% day, 10% week, 5% off the 52-week ends). */
function holdingFlags_(h) {
  var flags = []
  if (h.change1d !== null && h.change1d !== undefined) {
    if (h.change1d <= -5) flags.push('bigDrop1d')
    if (h.change1d >= 5) flags.push('bigGain1d')
  }
  if (h.change5d !== null && h.change5d !== undefined) {
    if (h.change5d <= -10) flags.push('drop5d')
    if (h.change5d >= 10) flags.push('gain5d')
  }
  if (h.price && h.low52 && h.price <= h.low52 * 1.05) flags.push('near52wLow')
  if (h.price && h.high52 && h.price >= h.high52 * 0.95) flags.push('near52wHigh')
  return flags
}

/** The one-page report prompt: the verified numbers, the headlines, and exactly what to write. */
function reportPrompt_(c, headlines) {
  var f = c.facts
  var lines = [
    'You are an equity research assistant. ' + c.symbol + ' (' + c.name + ') fell ' + Math.abs(Math.round(c.drop5d)) + '% in the last five trading days, to about $' + Math.round(c.price * 100) / 100 + ', shortly after a results filing.',
    'Verified figures from SEC filings:',
    '- Revenue growth (latest quarter, year over year): ' + fmt_(f.revenueGrowth, '%'),
    '- Free cash flow (latest fiscal year): ' + fmt_(f.fcf && f.fcf / 1e6, 'M USD') + ' (margin ' + fmt_(f.fcfMargin, '%') + ')',
    '- Net debt / EBITDA: ' + fmt_(f.netDebtToEbitda, ''),
    '- P/E now vs its own 10-year average: ' + fmt_(f.pe, '') + ' vs ' + fmt_(f.peAvg10y, ''),
    '- Insider open-market buys in the last 90 days (Form 4): ' + (f.insiderBuys90d || 0),
    'Recent headlines:',
  ]
  ;(headlines || []).forEach(function (h) {
    lines.push('- ' + h.title)
  })
  lines.push(
    '',
    'Write a one-page plain-text research note with exactly these sections: "Why it fell", "Did the fundamentals change", "Historical analogs" (similar quality companies that fell this hard after earnings and what happened within a year), "Bull case", "Bear case", "Recovery odds".',
    'Be specific and skeptical; separate temporary problems (inventory timing, one soft quarter, sentiment) from permanent ones (lost customers, structural disruption, debt or accounting trouble). No hype, no advice to buy or sell.',
    'Answer with JSON only: {"sentiment": 0-10 (how benign the story reads; 10 = clearly temporary), "recovery": 0-100 (your probability the price is back at its pre-drop level within 12 months), "report": "the note"}',
  )
  return lines.join('\n')
}

function fmt_(v, suffix) {
  return v === null || v === undefined ? 'unknown' : Math.round(v * 100) / 100 + (suffix ? suffix : '')
}

/** An RSS feed → its items' titles and links (titles may be CDATA-wrapped). */
function parseRssItems_(xml) {
  var items = []
  var itemRe = /<item>([\s\S]*?)<\/item>/g
  var m
  while ((m = itemRe.exec(xml)) && items.length < 10) {
    var title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(m[1])
    var link = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(m[1])
    if (title && link) items.push({ title: decodeEntities_(title[1].trim()), url: link[1].trim() })
  }
  return items
}

function decodeEntities_(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function padCik_(cik) {
  var s = String(cik)
  while (s.length < 10) s = '0' + s
  return s
}

function round2_(v) {
  return v === null || v === undefined ? v : Math.round(v * 100) / 100
}

/** Facts → what's worth storing on the candidate (no nulls; Firestore maps stay tidy). */
function cleanFacts_(f) {
  var out = {}
  ;['revenueGrowth', 'fcf', 'fcfMargin', 'netDebtToEbitda', 'insiderBuys90d', 'pe', 'peAvg10y'].forEach(function (k) {
    if (f[k] !== null && f[k] !== undefined) out[k] = round2_(f[k])
  })
  return out
}

// ---------------------------------------------------------------------------
// Data sources (UrlFetchApp)
// ---------------------------------------------------------------------------

/** Daily (or monthly) bars from Yahoo's chart endpoint, with Stooq as the fallback for daily closes. */
function dailyCloses_(symbol, range, interval) {
  range = range || '1mo'
  interval = interval || '1d'
  try {
    var data = fetchJson_('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=' + range + '&interval=' + interval, {})
    var result = data.chart && data.chart.result && data.chart.result[0]
    if (!result) throw new Error('no chart')
    var quote = result.indicators.quote[0]
    var closes = []
    var volumes = []
    var timestamps = []
    for (var i = 0; i < (result.timestamp || []).length; i++) {
      if (quote.close[i] !== null && quote.close[i] !== undefined) {
        closes.push(quote.close[i])
        volumes.push(quote.volume[i] || 0)
        timestamps.push(result.timestamp[i])
      }
    }
    if (!closes.length) throw new Error('empty chart')
    return { closes: closes, volumes: volumes, timestamps: timestamps, name: result.meta && (result.meta.shortName || result.meta.longName) }
  } catch (e) {
    if (interval !== '1d') throw e
    return stooqCloses_(symbol, range)
  }
}

/** Daily closes from Stooq (free CSV; US tickers get a ".us" suffix). */
function stooqCloses_(symbol, range) {
  var days = range === '1y' ? 370 : range === '10y' ? 3700 : 40
  var d2 = new Date()
  var d1 = new Date(d2.getTime() - days * 86400000)
  var fmt = function (d) {
    return d.toISOString().slice(0, 10).replace(/-/g, '')
  }
  var csv = fetchText_('https://stooq.com/q/d/l/?s=' + encodeURIComponent(symbol.toLowerCase()) + '.us&d1=' + fmt(d1) + '&d2=' + fmt(d2) + '&i=d', {})
  var lines = csv.trim().split('\n')
  if (lines.length < 2 || lines[0].indexOf('Date') !== 0) throw new Error('No price data for ' + symbol)
  var closes = []
  var volumes = []
  var timestamps = []
  for (var i = 1; i < lines.length; i++) {
    var cells = lines[i].split(',')
    var close = Number(cells[4])
    if (close) {
      closes.push(close)
      volumes.push(Number(cells[5]) || 0)
      timestamps.push(Math.floor(new Date(cells[0]).getTime() / 1000))
    }
  }
  if (!closes.length) throw new Error('No price data for ' + symbol)
  return { closes: closes, volumes: volumes, timestamps: timestamps, name: null }
}

/** Market caps for up to ~80 symbols in one call (Yahoo's quote endpoint needs a session cookie + crumb). */
function yahooQuotes_(symbols) {
  var session = yahooSession_()
  var url = 'https://query1.finance.yahoo.com/v7/finance/quote?crumb=' + encodeURIComponent(session.crumb) + '&fields=marketCap&symbols=' + encodeURIComponent(symbols.join(','))
  var data = fetchJson_(url, { Cookie: session.cookie })
  var out = {}
  ;(((data.quoteResponse || {}).result) || []).forEach(function (q) {
    if (q.symbol && q.marketCap) out[q.symbol] = q.marketCap
  })
  return out
}

/** Yahoo's cookie + crumb, cached for an hour. */
function yahooSession_() {
  var cache = CacheService.getScriptCache()
  var saved = cache.get('yahooSession')
  if (saved) return JSON.parse(saved)
  var res = UrlFetchApp.fetch('https://fc.yahoo.com', { muteHttpExceptions: true })
  var cookie = ((res.getAllHeaders()['Set-Cookie'] || '') + '').split(';')[0]
  if (!cookie) throw new Error('Yahoo gave no session cookie.')
  var crumb = UrlFetchApp.fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' },
    muteHttpExceptions: true,
  }).getContentText()
  if (!crumb || crumb.indexOf('{') >= 0) throw new Error('Yahoo gave no crumb: ' + crumb)
  var session = { cookie: cookie, crumb: crumb }
  cache.put('yahooSession', JSON.stringify(session), 3600)
  return session
}

/** Headlines from Google News RSS. */
function news_(symbol) {
  try {
    var xml = fetchText_('https://news.google.com/rss/search?q=' + encodeURIComponent('"' + symbol + '" stock') + '&hl=en-US&gl=US&ceid=US:en', {})
    return parseRssItems_(xml)
  } catch (e) {
    return []
  }
}

/** The SEC requires a contact in the User-Agent header for its free APIs. */
function edgarJson_(url, cfg) {
  return JSON.parse(edgarText_(url, cfg))
}

function edgarText_(url, cfg) {
  if (!cfg.EDGAR_CONTACT) throw new Error('Set the EDGAR_CONTACT script property (e.g. "Align scanner you@example.com"); the SEC requires it.')
  var res = UrlFetchApp.fetch(url, { headers: { 'User-Agent': cfg.EDGAR_CONTACT, 'Accept-Encoding': 'gzip' }, muteHttpExceptions: true })
  if (res.getResponseCode() >= 300) throw new Error('EDGAR ' + url.split('?')[0] + ' answered ' + res.getResponseCode())
  return res.getContentText()
}

/** The Gemini free tier writes the note; without a key (or on any trouble) the numbers still ship. */
function gemini_(cfg, prompt) {
  var fallback = { sentiment: 5, recovery: null, report: '' }
  if (!cfg.GEMINI_API_KEY) return fallback
  try {
    var res = http_('post', cfg.GEMINI_URL + '/models/' + cfg.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(cfg.GEMINI_API_KEY), {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    })
    var text = res.candidates[0].content.parts[0].text
    var parsed = JSON.parse(text)
    return {
      sentiment: typeof parsed.sentiment === 'number' ? parsed.sentiment : 5,
      recovery: typeof parsed.recovery === 'number' ? Math.round(parsed.recovery) : null,
      report: String(parsed.report || ''),
    }
  } catch (e) {
    Logger.log('Gemini call failed: %s', e && e.message)
    return fallback
  }
}

function fetchJson_(url, headers) {
  return JSON.parse(fetchText_(url, headers))
}

function fetchText_(url, headers) {
  for (var attempt = 0; ; attempt++) {
    var res = UrlFetchApp.fetch(url, { headers: headers || {}, muteHttpExceptions: true })
    var code = res.getResponseCode()
    if (code === 429 && attempt < 2) {
      Utilities.sleep(2000 * (attempt + 1))
      continue
    }
    if (code >= 300) throw new Error('GET ' + url.split('?')[0] + ' failed (' + code + ')')
    return res.getContentText()
  }
}

// ---------------------------------------------------------------------------
// Config and state (Script Properties; state is JSON, chunked under 9 KB per value)
// ---------------------------------------------------------------------------

function scanConfig_(p) {
  var cfg = {}
  Object.keys(DEFAULTS).forEach(function (k) {
    cfg[k] = p[k] || DEFAULTS[k]
  })
  ;['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'BOT_EMAIL', 'BOT_PASSWORD'].forEach(function (k) {
    if (!p[k]) throw new Error('Missing script property ' + k + ' (Project Settings → Script properties).')
    cfg[k] = p[k]
  })
  cfg.EDGAR_CONTACT = p.EDGAR_CONTACT || ''
  cfg.GEMINI_API_KEY = p.GEMINI_API_KEY || ''
  cfg.CUSTOM_UNIVERSE = p.CUSTOM_UNIVERSE || ''
  cfg.TIME_ZONE = p.TIME_ZONE || Session.getScriptTimeZone()
  cfg.MIN_CAP = Number(cfg.MIN_CAP_B) * 1e9
  cfg.MAX_CAP = Number(cfg.MAX_CAP_B) * 1e9
  cfg.MIN_DROP = Number(cfg.MIN_DROP)
  cfg.MAX_DROP = Number(cfg.MAX_DROP)
  cfg.MIN_DOLLAR_VOL = Number(cfg.MIN_DOLLAR_VOL_M) * 1e6
  cfg.MIN_SCORE = Number(cfg.MIN_SCORE)
  cfg.EARNINGS_DAYS = Number(cfg.EARNINGS_DAYS)
  cfg.SCAN_BATCH = Number(cfg.SCAN_BATCH)
  return cfg
}

function today_(cfg) {
  return Utilities.formatDate(new Date(), cfg.TIME_ZONE, 'yyyy-MM-dd')
}

var STATE_KEY = 'SCAN_STATE'
var STATE_CHUNK = 8000

function stateSave_(props, state) {
  var json = JSON.stringify(state)
  var chunks = Math.ceil(json.length / STATE_CHUNK) || 1
  var values = {}
  for (var i = 0; i < chunks; i++) values[STATE_KEY + '.' + i] = json.substr(i * STATE_CHUNK, STATE_CHUNK)
  values[STATE_KEY + '.n'] = String(chunks)
  props.setProperties(values)
  // Drop leftover chunks from a bigger earlier state.
  for (var j = chunks; props.getProperty(STATE_KEY + '.' + j) !== null; j++) props.deleteProperty(STATE_KEY + '.' + j)
}

function stateLoad_(props) {
  var n = Number(props.getProperty(STATE_KEY + '.n') || 0)
  if (!n) return {}
  var json = ''
  for (var i = 0; i < n; i++) json += props.getProperty(STATE_KEY + '.' + i) || ''
  try {
    return JSON.parse(json)
  } catch (e) {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Firebase REST (the same shape as calendar-sync.gs)
// ---------------------------------------------------------------------------

function http_(method, url, body, token) {
  var options = { method: method, contentType: 'application/json', muteHttpExceptions: true, headers: {} }
  if (body !== undefined) options.payload = JSON.stringify(body)
  if (token) options.headers.Authorization = 'Bearer ' + token
  var res = UrlFetchApp.fetch(url, options)
  var code = res.getResponseCode()
  var text = res.getContentText()
  if (code >= 300) throw new Error(method + ' ' + url.split('?')[0] + ' failed (' + code + '): ' + text)
  return text ? JSON.parse(text) : {}
}

function signIn_(cfg) {
  var res = http_('post', cfg.AUTH_URL + '/accounts:signInWithPassword?key=' + encodeURIComponent(cfg.FIREBASE_API_KEY), {
    email: cfg.BOT_EMAIL,
    password: cfg.BOT_PASSWORD,
    returnSecureToken: true,
  })
  return { token: res.idToken, uid: res.localId }
}

function firestoreApi_(cfg, auth) {
  var root = 'projects/' + cfg.FIREBASE_PROJECT_ID + '/databases/(default)/documents'
  var base = cfg.FIRESTORE_URL + '/' + root
  return {
    uid: auth.uid,
    docName: function (path) {
      return root + '/' + path
    },
    /** Every document in a collection (the investing settings docs: one per member). */
    all: function (collection) {
      var res = http_('post', base + ':runQuery', { structuredQuery: { from: [{ collectionId: collection }] } }, auth.token)
      return res
        .filter(function (r) {
          return r.document
        })
        .map(function (r) {
          return { id: r.document.name.split('/').pop(), fields: fromFields_(r.document.fields || {}) }
        })
    },
    /** Writes the whole document at this path (creating it if needed). */
    set: function (path, data) {
      http_('post', base + ':commit', { writes: [{ update: { name: root + '/' + path, fields: toFields_(data) } }] }, auth.token)
    },
  }
}

function toValue_(v) {
  if (v === null) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue_) } }
  return { mapValue: { fields: toFields_(v) } }
}

function toFields_(obj) {
  var out = {}
  Object.keys(obj).forEach(function (k) {
    if (obj[k] !== undefined) out[k] = toValue_(obj[k])
  })
  return out
}

function fromValue_(v) {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue_)
  if ('mapValue' in v) return fromFields_(v.mapValue.fields || {})
  return undefined
}

function fromFields_(fields) {
  var out = {}
  Object.keys(fields).forEach(function (k) {
    out[k] = fromValue_(fields[k])
  })
  return out
}
