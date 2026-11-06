/**
 * Align: market scanner (DESIGN.md §5.13).
 *
 * Runs in Google Apps Script (free) and writes to Firestore as the household's helper account ("bot"), so the normal
 * security rules apply. Each investmentLists/{id} has its own owner and audience. Holdings lists receive data/summary;
 * each owner's overreactions list receives data/watchlist. Legacy investing/{uid} docs remain supported until migration.
 *
 *   summary    — today's look at their own stocks: price, day / week change, 52-week range, news headlines, and
 *                P/E, available list-local industry peer comparisons, and flags (a nudge to look closer, never advice).
 *   watchlist  — the post-earnings dislocation screen: quality mid-caps that just fell much more than the business
 *                did. A three-stage funnel: (1) price dropped 15–40% in 5 days on real volume, (2) fundamentals from
 *                Yahoo Finance (revenue still growing, free cash flow positive, manageable debt, insiders buying),
 *                (3) a 0–100 score and, with a free Gemini API key, a one-page report (why it fell, bull / bear
 *                case, historical analogs, a recovery estimate).
 *
 * Everything is free: the ticker universe from Nasdaq Trader's symbol directory, prices from Yahoo Finance's public
 * chart endpoint (Stooq as fallback), fundamentals / insider buying / earnings timing from Yahoo's quoteSummary,
 * headlines from Google News RSS, and the write-up from the Gemini API's free tier. (SEC EDGAR would be the official
 * source, but it requires a contact User-Agent header and Apps Script's UrlFetchApp can't change its User-Agent, so
 * the SEC answers 403.) The 6-minute execution limit is handled by scanning in slices: each run picks up where the
 * last one left off (state in Script Properties), so a full pass over the universe takes a day or two — fine, since
 * the screen looks for drops that happened over the last 5 trading days.
 *
 * Setup (see scripts/market-scanner/README.md). Script properties:
 *   FIREBASE_API_KEY     the web app's apiKey
 *   FIREBASE_PROJECT_ID  align-a32c1
 *   BOT_EMAIL            the helper account's Firebase Auth email (the calendar bot works)
 *   BOT_PASSWORD         its password
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

/** Publishes saved progress to Align and logs it, without changing SCAN_STATE or advancing the pass. */
function scanStatus() {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(1000)) throw new Error('A scan slice is running; wait for it to finish before publishing its saved status.')
  try {
    var props = PropertiesService.getScriptProperties()
    var state = stateLoad_(props)
    var cfg = scanConfig_(props.getProperties())
    var api = firestoreApi_(cfg, signIn_(cfg))
    publishStatus_(api, scannerUsers_(api), state, 'snapshot')
    Logger.log(
      'Universe: %s tickers (built %s). Pass cursor: %s. Stage-1 passers waiting: %s. Scored: %s. Last watchlist: %s.',
      (state.universe || []).length,
      state.universeAt || 'never',
      state.cursor || 0,
      (state.passers || []).length,
      (state.scored || []).length,
      state.watchlistAt || 'never',
    )
  } finally {
    lock.releaseLock()
  }
}

/** Tests KMB's public valuation lookup without advancing or resetting the scan. */
function checkValuation() {
  var h = holdingFor_('KMB')
  Logger.log('KMB: trailing P/E %s; forward P/E %s; valuation checked %s; source issue %s.',
    h.peTrailing, h.peForward, h.valuationCheckedAt, h.valuationError || 'none')
}

function scannerUsers_(api) {
  var lists = api.all('investmentLists')
  var owners = {}
  lists.forEach(function (l) { owners[l.fields.ownerId] = true })
  return api.all('investing').filter(function (u) { return !owners[u.id] }).concat(lists)
}

// ---------------------------------------------------------------------------
// The scan: summaries every run; universe → stage 1 → stage 2/3 in slices
// ---------------------------------------------------------------------------

function scan_() {
  var started = Date.now()
  var props = PropertiesService.getScriptProperties()
  var cfg = scanConfig_(props.getProperties())
  var api = firestoreApi_(cfg, signIn_(cfg))
  var users = scannerUsers_(api)
  if (!users.length) {
    Logger.log('No investmentLists or legacy investing accounts found; open Investing in Align to set up lists.')
    return
  }
  var state = stateLoad_(props)
  var budget = function () {
    return Date.now() - started < MAX_RUN_MS
  }
  var work = { screened: 0, priceErrors: 0, analyzed: 0, analysisErrors: 0, qualified: 0 }
  state.lastRun = { startedAt: new Date(started).toISOString(), work: work }
  var checkpointAt = started
  var checkpoint = function (execution, stage) {
    stateSave_(props, state)
    publishStatus_(api, users, state, execution, stage)
    checkpointAt = Date.now()
  }

  try {
    checkpoint('running', 'refreshing')
    // 1. Today's summary of each member's own stocks (every run, so prices stay fresh).
    summarize_(api, users, cfg, budget)

    // 2. The ticker universe: mid-caps worth scanning, rebuilt weekly. Built in slices too (market caps come from
    //    batch quotes, ~80 tickers a call over the whole US market).
    if (universeStale_(state, cfg)) {
      checkpoint('running', 'building')
      buildUniverseStep_(state, cfg, budget)
      if (universeStale_(state, cfg)) {
        state.lastRun.finishedAt = new Date().toISOString()
        checkpoint('idle')
        return // keep building next run
      }
    }
    checkpoint('running')

    // 3. Stage 1 over the universe: 5-day drop on real dollar volume. A slice per run.
    var universe = state.universe || []
    state.cursor = state.cursor || 0
    state.passers = state.passers || []
    state.scored = state.scored || []
    // Counts added mid-pass describe only work since this version; never fabricate old error/analysis counts.
    state.passStats = state.passStats || { since: new Date().toISOString(), priceErrors: 0, analyzed: 0, analysisErrors: 0 }
    var batch = 0
    while (state.cursor < universe.length && batch < cfg.SCAN_BATCH && budget()) {
      var row = universe[state.cursor] // [symbol, marketCap]
      state.cursor++
      batch++
      work.screened++
      try {
        var bars = dailyCloses_(row[0])
        var check = {
          drop5d: drop5d_(bars.closes),
          dollarVol: avgDollarVol_(bars.closes, bars.volumes),
          marketCap: row[1],
        }
        if (stage1Pass_(check, cfg)) {
          state.passers.push({ symbol: row[0], cap: row[1], drop5d: check.drop5d, price: bars.closes[bars.closes.length - 1] })
          Logger.log('Stage 1: %s fell %s%% in 5 days.', row[0], Math.round(check.drop5d))
        }
      } catch (e) {
        work.priceErrors++
        state.passStats.priceErrors++
        Logger.log('Price screening for %s failed: %s', row[0], e && e.message)
      }
      Utilities.sleep(120)
      if (Date.now() - checkpointAt >= 30000) checkpoint('running')
    }

    // 4. Stage 2 + 3 for the passers (a handful): fundamentals, insiders, score, report. Then publish.
    if (state.cursor >= universe.length) {
      checkpoint('running', 'analyzing')
      while (state.passers.length && budget()) {
        var p = state.passers.shift()
        work.analyzed++
        state.passStats.analyzed++
        try {
          var candidate = analyze_(p, cfg)
          if (candidate) { state.scored.push(candidate); work.qualified++ }
        } catch (e) {
          work.analysisErrors++
          state.passStats.analysisErrors++
          Logger.log('Analyzing %s failed: %s', p.symbol, e && e.message)
        }
        if (Date.now() - checkpointAt >= 30000) checkpoint('running')
      }
      if (!state.passers.length) {
        publishWatchlist_(api, users, state, cfg)
        state.lastPass = {
          completedAt: new Date().toISOString(), screened: universe.length,
          qualified: state.scored.length, kept: Math.min(CANDIDATES_KEPT, state.scored.length),
          stats: state.passStats,
        }
        state.cursor = 0
        state.scored = []
        state.watchlistAt = today_(cfg)
        state.lastRun.completed = true
        delete state.passStats
      }
    }
    state.lastRun.finishedAt = new Date().toISOString()
    checkpoint('idle')
    Logger.log('Slice done: cursor %s/%s, %s passers waiting, %s scored.', state.cursor, universe.length, state.passers.length, (state.scored || []).length)
  } catch (e) {
    state.lastRun.finishedAt = new Date().toISOString()
    state.lastRun.error = 'Scanner run failed. Check Apps Script Executions for details.'
    // Preserve progress even if a source or status write fails. Never reset the in-flight pass.
    stateSave_(props, state)
    try { publishStatus_(api, users, state, 'error') }
    catch (statusError) { Logger.log('Publishing scanner error status failed: %s', statusError && statusError.message) }
    throw e
  }
}

function scannerStatus_(state, execution, stage) {
  var total = (state.universe || []).length
  var cursor = Math.min(state.cursor || 0, total)
  var lastRun = state.lastRun || null
  var completed = !!(lastRun && lastRun.completed) && cursor === 0 && !(state.passers || []).length
  return {
    updatedAt: new Date().toISOString(), execution: execution,
    stage: stage || (state.tickers || !total ? 'building' : completed ? 'completed' : cursor >= total ? 'analyzing' : 'screening'),
    universe: total, screened: cursor, queued: (state.passers || []).length,
    qualified: completed && state.lastPass ? state.lastPass.qualified : (state.scored || []).length,
    buildTotal: (state.tickers || []).length, buildChecked: state.tickCursor || 0,
    stats: state.passStats || null, lastRun: lastRun, lastPass: state.lastPass || null,
    lastWatchlistAt: state.watchlistAt || null,
    warning: state.universeError || '',
  }
}

function publishStatus_(api, users, state, execution, stage) {
  var status = scannerStatus_(state, execution, stage)
  users.forEach(function (u) {
    api.set((u.fields.kind ? 'investmentLists/' : 'investing/') + u.id + '/data/status', status)
  })
}

// ---------------------------------------------------------------------------
// Summaries: each member's own stocks
// ---------------------------------------------------------------------------

function summarize_(api, users, cfg, budget) {
  var cache = {} // symbol → holding, shared across members
  var day = today_(cfg)
  users.forEach(function (u) {
    if (u.fields.kind === 'overreactions') return
    var symbols = symbolsOf_(u.fields)
    if (!symbols.length) return
    var holdings = []
    symbols.slice(0, 100).forEach(function (symbol) {
      if (budget && !budget()) return
      if (!cache[symbol]) {
        try {
          cache[symbol] = holdingFor_(symbol)
        } catch (e) {
          Logger.log('Holding %s failed: %s', symbol, e && e.message)
          cache[symbol] = { symbol: symbol, flags: [], news: [], error: 'Price data unavailable. See scanner execution logs.' }
        }
        Utilities.sleep(120)
      }
      var holding = {}
      Object.keys(cache[symbol]).forEach(function (k) { holding[k] = cache[symbol][k] })
      holdings.push(holding)
    })
    addPeerComparisons_(holdings)
    // A partial refresh must not erase stocks from the previous published summary.
    if (holdings.length < Math.min(symbols.length, 100)) {
      Logger.log('Holdings refresh for %s deferred: execution time budget reached.', u.id)
      return
    }
    api.set((u.fields.kind ? 'investmentLists/' : 'investing/') + u.id + '/data/summary', {
      day: day, generatedAt: new Date().toISOString(), holdings: holdings,
      priceErrors: holdings.filter(function (h) { return !!h.error }).length,
      valuationIssues: holdings.filter(function (h) { return !!h.valuationError }).length,
      note: symbols.length > 100 ? 'Only the first 100 symbols are refreshed per list. Split this list to refresh the rest.' : '',
    })
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
  h.valuationCheckedAt = new Date().toISOString()
  try {
    var qs = yahooQuoteSummary_(symbol)
    if (!qs) throw new Error('No fundamentals returned.')
    var facts = factsFromSummary_(qs, h.price)
    h.peTrailing = facts.peTrailing
    h.peForward = facts.peForward
    h.industry = (qs.assetProfile || {}).industry || ''
    if (h.peTrailing === null || h.peForward === null) {
      h.valuationError = 'Yahoo did not supply ' + (h.peTrailing === null && h.peForward === null ? 'trailing or forward P/E' : h.peTrailing === null ? 'trailing P/E' : 'forward P/E') + ' for ' + symbol + '. Missing data is not evidence of poor valuation.'
      Logger.log('%s', h.valuationError)
    }
  } catch (e) {
    Logger.log('Valuation for %s failed: %s', symbol, e && e.message)
    h.valuationError = 'Yahoo valuation lookup failed for ' + symbol + ': ' + (e && e.message) + '. The candidate scan does not block holdings lookups.'
  }
  h.news = news_(symbol).slice(0, 3)
  return h
}

/** Comparisons use only this list's stocks, never names from another person's private holdings. */
function addPeerComparisons_(holdings) {
  holdings.forEach(function (h) {
    if (!h.industry || !(h.peForward > 0) || !isFinite(h.peForward)) return
    var peers = holdings.filter(function (p) {
      return p.symbol !== h.symbol && p.industry === h.industry && p.peForward > 0 && isFinite(p.peForward)
    }).map(function (p) { return p.peForward }).sort(function (a, b) { return a - b })
    if (peers.length < 3) return
    var mid = Math.floor(peers.length / 2)
    var median = peers.length % 2 ? peers[mid] : (peers[mid - 1] + peers[mid]) / 2
    h.peerComparison = { count: peers.length, medianForwardPe: round2_(median), premiumPct: round2_((h.peForward / median - 1) * 100) }
  })
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
// The universe: US common stocks from Nasdaq Trader's symbol directory + batch market caps
// ---------------------------------------------------------------------------

function universeStale_(state, cfg) {
  if (!state.universe || !state.universe.length) return true
  var age = (Date.now() - new Date(state.universeAt).getTime()) / 86400000
  return !(age < UNIVERSE_DAYS)
}

/** One slice of the rebuild: first the ticker list, then market caps batch by batch. */
function buildUniverseStep_(state, cfg, budget) {
  if (cfg.CUSTOM_UNIVERSE) {
    // A hand-kept list skips the market-cap screen (caps unknown → every name passes that filter).
    state.universe = cfg.CUSTOM_UNIVERSE.split(',').map(function (s) {
      return [s.trim().toUpperCase(), null]
    })
    state.universeAt = new Date().toISOString()
    state.cursor = 0
    return
  }
  if (!state.tickers) {
    // Every US-listed common stock (both files are pipe-delimited; ETFs, test issues, units / warrants / preferred
    // tickers are dropped). The SEC's own ticker list would be nicer, but it 403s Apps Script's fixed User-Agent.
    var tickers = parseListedSymbols_(fetchText_('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', {})).concat(
      parseListedSymbols_(fetchText_('https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', {})),
    )
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
      var quotes = yahooQuotes_(slice)
      slice.forEach(function (t) {
        var cap = quotes[t]
        if (cap && cap >= cfg.MIN_CAP && cap <= cfg.MAX_CAP) state.newUniverse.push([t, cap])
      })
    } catch (e) {
      Logger.log('Quote batch failed (%s); will retry next run.', e && e.message)
      state.universeError = 'Market-cap lookup failed; this batch will retry on the next run. Check Apps Script Executions.'
      state.tickCursor -= slice.length
      return
    }
    delete state.universeError
    Utilities.sleep(300)
  }
  if (state.tickCursor >= state.tickers.length) {
    state.universe = state.newUniverse
    state.universeAt = new Date().toISOString()
    state.cursor = 0
    state.passers = []
    state.scored = []
    delete state.passStats
    delete state.tickers
    delete state.tickCursor
    delete state.newUniverse
    Logger.log('Universe ready: %s mid-caps ($%sB–$%sB).', state.universe.length, cfg.MIN_CAP / 1e9, cfg.MAX_CAP / 1e9)
  }
}

// ---------------------------------------------------------------------------
// Stages 2 and 3: Yahoo fundamentals, insiders, score, AI report
// ---------------------------------------------------------------------------

/** A stage-1 passer → a scored candidate, or null (earnings weren't recent, or numbers missing). */
function analyze_(p, cfg) {
  var qs = yahooQuoteSummary_(p.symbol)
  if (!qs) throw new Error('Yahoo returned no fundamentals for ' + p.symbol)
  // Stage 1 asked "did it fall"; here: did it fall *because of earnings* (a report in the window)?
  if (!postEarnings_(nextEarningsSec_(qs), Date.now(), cfg.EARNINGS_DAYS)) return null
  var facts = factsFromSummary_(qs, p.price)
  var name = ((qs.price || {}).longName || (qs.price || {}).shortName || p.symbol) + ''
  var headlines = news_(p.symbol).slice(0, 5)
  var ai = { sentiment: 5, recovery: null, report: '' }
  var provisional = {}
  Object.keys(facts).forEach(function (k) {
    provisional[k] = facts[k]
  })
  provisional.sentiment = 10
  if (cfg.GEMINI_API_KEY && scoreCandidate_(provisional).score >= cfg.MIN_SCORE) {
    ai = gemini_(cfg, reportPrompt_({ symbol: p.symbol, name: name, drop5d: p.drop5d, price: p.price, marketCap: p.cap, facts: facts }, headlines))
  }
  facts.sentiment = ai.sentiment
  var scored = scoreCandidate_(facts)
  if (scored.score < cfg.MIN_SCORE) return null
  return {
    symbol: p.symbol,
    name: name,
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

/** The next scheduled earnings date (epoch seconds), from quoteSummary's calendarEvents. */
function nextEarningsSec_(qs) {
  var dates = (((qs.calendarEvents || {}).earnings || {}).earningsDate || [])
  return dates.length && dates[0] && dates[0].raw ? dates[0].raw : null
}

/**
 * Did earnings land within the last `days` days? Yahoo moves the earnings date to the next quarter as soon as a
 * company reports, so "the last report" sits about one quarter (91 days) before the next scheduled date. A few days'
 * slack covers reporting-cycle drift; without a scheduled date there's no way to tell, so it fails closed.
 */
function postEarnings_(nextEarningsSec, nowMs, days) {
  if (!nextEarningsSec) return false
  var lastApproxMs = nextEarningsSec * 1000 - 91 * 86400000
  var daysSince = (nowMs - lastApproxMs) / 86400000
  return daysSince >= -4 && daysSince <= days
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
    stats: state.passStats || null,
    note: candidates.length ? '' : 'The last pass found no post-earnings dislocations that cleared the screen — most passes don’t.',
  }
  var published = 0
  users.forEach(function (u) {
    if (u.fields.kind === 'holdings') return
    api.set((u.fields.kind ? 'investmentLists/' : 'investing/') + u.id + '/data/watchlist', doc)
    published++
  })
  Logger.log('Watchlist published: %s candidates to %s feed(s).', candidates.length, published)
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

/**
 * A Nasdaq Trader symbol-directory file (pipe-delimited) → plain common-stock tickers. Both files work: the header
 * names the symbol column ("Symbol" or "ACT Symbol"), ETFs and test issues are flagged, and units / warrants /
 * preferred shares carry $ . = or a class suffix worth keeping out of a fundamentals screen.
 */
function parseListedSymbols_(text) {
  var lines = text.trim().split('\n')
  var header = lines[0].split('|')
  var symbolCol = header.indexOf('Symbol')
  if (symbolCol < 0) symbolCol = header.indexOf('ACT Symbol')
  var etfCol = header.indexOf('ETF')
  var testCol = header.indexOf('Test Issue')
  if (symbolCol < 0) return []
  var out = []
  for (var i = 1; i < lines.length; i++) {
    var cells = lines[i].split('|')
    var symbol = (cells[symbolCol] || '').trim()
    if (!symbol || symbol.indexOf('File Creation') >= 0) continue
    if (!/^[A-Z]{1,5}$/.test(symbol)) continue
    if (etfCol >= 0 && cells[etfCol] === 'Y') continue
    if (testCol >= 0 && cells[testCol] === 'Y') continue
    out.push(symbol)
  }
  return out
}

/** A quoteSummary 'raw' number, or null. */
function qsRaw_(module, key) {
  var v = (module || {})[key]
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  return typeof v.raw === 'number' ? v.raw : null
}

/**
 * A Yahoo quoteSummary result + the current price → what the score needs: quarterly YoY revenue growth, free cash
 * flow and its margin, net debt / EBITDA, trailing and forward P/E, and the insider purchase count Yahoo reports
 * for the last 6 months.
 */
function factsFromSummary_(qs, price) {
  var fd = qs.financialData || {}
  var ks = qs.defaultKeyStatistics || {}
  var growth = qsRaw_(fd, 'revenueGrowth')
  var fcf = qsRaw_(fd, 'freeCashflow')
  var revenue = qsRaw_(fd, 'totalRevenue')
  var debt = qsRaw_(fd, 'totalDebt')
  var cash = qsRaw_(fd, 'totalCash')
  var ebitda = qsRaw_(fd, 'ebitda')
  var netDebtToEbitda = null
  if (debt !== null) {
    var netDebt = debt - (cash || 0)
    if (netDebt <= 0) netDebtToEbitda = 0
    else if (ebitda && ebitda > 0) netDebtToEbitda = round2_(netDebt / ebitda)
  }
  var eps = qsRaw_(ks, 'trailingEps')
  var detail = qs.summaryDetail || {}
  var trailing = qsRaw_(detail, 'trailingPE')
  if (trailing === null) trailing = qsRaw_(ks, 'trailingPE')
  if (trailing === null && price && eps) trailing = price / eps
  var forward = qsRaw_(ks, 'forwardPE')
  if (forward === null) forward = qsRaw_(detail, 'forwardPE')
  return {
    revenueGrowth: growth === null ? null : round2_(growth * 100),
    fcf: fcf,
    fcfMargin: fcf !== null && revenue ? round2_((fcf / revenue) * 100) : null,
    netDebtToEbitda: netDebtToEbitda,
    peTrailing: round2_(trailing),
    peForward: round2_(forward),
    insiderBuys6m: qsRaw_(qs.netSharePurchaseActivity || {}, 'buyInfoCount'),
  }
}

/**
 * The 0–100 score: revenue growth 25, free cash flow 20, balance sheet 20, valuation (the forward P/E's discount to
 * trailing — earnings expected to recover) 15, insider buying 10, sentiment 10 (the AI's read of the news; 5 =
 * neutral without a key). Missing data lands mid-scale rather than failing the stock.
 */
function scoreCandidate_(f) {
  var parts = {}
  parts.growth = f.revenueGrowth !== null && f.revenueGrowth !== undefined && f.revenueGrowth > 0 ? Math.min(25, Math.floor(f.revenueGrowth * 1.25)) : 0
  parts.fcf = f.fcf !== null && f.fcf !== undefined && f.fcf > 0 ? Math.max(4, Math.min(20, Math.floor((f.fcfMargin || 0) * 2))) : 0
  var nde = f.netDebtToEbitda
  parts.balance = nde === null || nde === undefined ? 10 : nde <= 0 ? 20 : nde < 1 ? 18 : nde < 2 ? 14 : nde < 3 ? 8 : 2
  parts.valuation = f.peForward > 0 && f.peTrailing > 0 ? (f.peForward < f.peTrailing ? Math.min(15, Math.floor((1 - f.peForward / f.peTrailing) * 30)) : 0) : 7
  var buys = f.insiderBuys6m || 0
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
    'You are an equity research assistant. ' + c.symbol + ' (' + c.name + ') fell ' + Math.abs(Math.round(c.drop5d)) + '% in the last five trading days, to about $' + Math.round(c.price * 100) / 100 + ', shortly after reporting earnings.',
    'Verified figures (Yahoo Finance fundamentals):',
    '- Revenue growth (latest quarter, year over year): ' + fmt_(f.revenueGrowth, '%'),
    '- Free cash flow (trailing): ' + fmt_(f.fcf && f.fcf / 1e6, 'M USD') + ' (margin ' + fmt_(f.fcfMargin, '%') + ')',
    '- Net debt / EBITDA: ' + fmt_(f.netDebtToEbitda, ''),
    '- P/E: trailing ' + fmt_(f.peTrailing, '') + ', forward ' + fmt_(f.peForward, ''),
    '- Insider purchases reported in the last 6 months: ' + (f.insiderBuys6m || 0),
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

function round2_(v) {
  return v === null || v === undefined ? v : Math.round(v * 100) / 100
}

/** Facts → what's worth storing on the candidate (no nulls; Firestore maps stay tidy). */
function cleanFacts_(f) {
  var out = {}
  ;['revenueGrowth', 'fcf', 'fcfMargin', 'netDebtToEbitda', 'insiderBuys6m', 'peTrailing', 'peForward'].forEach(function (k) {
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
  var crumbResponse = UrlFetchApp.fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' },
    muteHttpExceptions: true,
  })
  var crumbCode = crumbResponse.getResponseCode()
  if (crumbCode >= 300) throw new Error('Yahoo session crumb request failed (' + crumbCode + ')')
  var crumb = crumbResponse.getContentText()
  if (!crumb || /[\s{<]/.test(crumb)) throw new Error('Yahoo gave an invalid session crumb.')
  var session = { cookie: cookie, crumb: crumb }
  cache.put('yahooSession', JSON.stringify(session), 3600)
  return session
}

/** Fundamentals, insider activity and the next earnings date for one symbol, or null when Yahoo has nothing. */
function yahooQuoteSummary_(symbol) {
  var session = yahooSession_()
  var url =
    'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' +
    encodeURIComponent(symbol) +
    '?modules=financialData,defaultKeyStatistics,summaryDetail,netSharePurchaseActivity,calendarEvents,price,assetProfile&crumb=' +
    encodeURIComponent(session.crumb)
  var data = fetchJson_(url, { Cookie: session.cookie })
  if (data.quoteSummary && data.quoteSummary.error) throw new Error('Yahoo quoteSummary: ' + data.quoteSummary.error.code)
  var result = data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0]
  return result || null
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
  var count = props.getProperty(STATE_KEY + '.n')
  if (count === null && props.getProperty(STATE_KEY + '.0') === null) return {}
  var n = Number(count)
  if (!Number.isInteger(n) || n < 1) throw new Error('Saved scanner chunk count is unreadable. Do not reset; check SCAN_STATE properties.')
  var json = ''
  for (var i = 0; i < n; i++) {
    var chunk = props.getProperty(STATE_KEY + '.' + i)
    if (chunk === null) throw new Error('Saved scanner chunk ' + i + ' is missing. Do not reset; check SCAN_STATE properties.')
    json += chunk
  }
  try {
    return JSON.parse(json)
  } catch (e) {
    throw new Error('Saved scanner state is unreadable. Do not reset it; check SCAN_STATE properties before continuing.')
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
