# Market scanner (Apps Script)

`market-scanner.gs` powers Align's **Investing** section (on Today, in More… to start). It runs free in Google Apps
Script and writes to Firestore as the household's helper account, so the normal security rules apply — each member's
investing data stays theirs alone. See DESIGN.md §5.13.

For every member who has added symbols in Align (Investing → add symbols, or import an E*TRADE portfolio CSV) it
keeps two things fresh:

- **Today's summary** of their own stocks: price, day / week change, 52-week range, headlines, and flags on anything
  that moved a lot — a nudge to look closer, never advice.
- **The watchlist**: a post-earnings dislocation screen over US mid-caps ($2B–$50B by default). Three stages:
  1. **Overreaction:** fell 15–40% in 5 trading days on >$10M/day traded, with an earnings report inside the last
     10 days.
  2. **Fundamentals** (Yahoo Finance): revenue still growing, free cash flow positive, net debt/EBITDA manageable,
     insiders buying (Yahoo's purchase count for the last 6 months).
  3. **Score + report:** 0–100 (growth 25, FCF 20, balance sheet 20, valuation — the forward P/E's discount to
     trailing — 15, insiders 10, news sentiment 10). With a free Gemini key, candidates get a one-page note: why it
     fell, whether the fundamentals changed, historical analogs, bull case, bear case, recovery odds.

Everything is free: the ticker universe from Nasdaq Trader's symbol directory, prices from Yahoo Finance's chart
endpoint (Stooq fallback), fundamentals / insiders / earnings timing from Yahoo's quoteSummary, headlines from Google
News RSS, the write-up from the Gemini API free tier. (SEC EDGAR would be the official source, but the SEC requires a
contact `User-Agent` header and Apps Script's `UrlFetchApp` always sends its own fixed one, so the SEC answers 403 —
EDGAR simply can't be reached from Apps Script.) The 6-minute execution limit is handled by scanning in slices — each
run (every 4 hours) picks up where the last left off, so a full pass over ~1,000+ mid-caps completes in a day or two.
That's fine: the screen looks for 5-day moves, which stay visible for days.

**This is a research helper, not investment advice, and it never trades.**

## One-time setup

1. **Helper account.** Reuse the calendar bot from `scripts/apps-script/README.md` (steps 1–2 there). Nothing new is
   needed: the rules let any `bot: true` member write the scanner's documents.
2. **Create the script.** Go to https://script.google.com → **New project**, name it `Align market scanner`.
   - Replace `Code.gs` with `market-scanner.gs`.
   - ⚙️ Project Settings → tick **Show "appsscript.json" manifest file in editor**, replace it with `appsscript.json`
     from this folder (keep your own `timeZone`).
3. **Script properties.** ⚙️ Project Settings → Script properties → add:

   | Property | Value |
   |---|---|
   | `FIREBASE_API_KEY` | the web app's `apiKey` (same as `.env.production.local`) |
   | `FIREBASE_PROJECT_ID` | `align-a32c1` |
   | `BOT_EMAIL` | the helper account's email |
   | `BOT_PASSWORD` | its password |
   | `GEMINI_API_KEY` | *optional:* a free key from https://aistudio.google.com — turns on the one-page reports |

   Optional tuning: `GEMINI_MODEL` (`gemini-2.5-flash`), `MIN_CAP_B` (2), `MAX_CAP_B` (50), `MIN_DROP` (15),
   `MAX_DROP` (40), `MIN_DOLLAR_VOL_M` (10), `MIN_SCORE` (60), `EARNINGS_DAYS` (10), `SCAN_BATCH` (200),
   `CUSTOM_UNIVERSE` (a comma-separated ticker list that replaces the automatic mid-cap universe), `TIME_ZONE`.
4. **Add your stocks in Align** (Today → More… → Investing): type symbols or import an E*TRADE portfolio CSV. The
   scanner only runs for members who have.
5. **Run it.** Pick `installTrigger` and click **Run**; authorize it (your own unpublished script: *Advanced → Go to
   Align market scanner*). That schedules a run every 4 hours and does the first slice.
6. Check **Executions**: the first runs build the ticker universe (`Universe ready: … mid-caps`), then scan slices
   (`Slice done: cursor …`), and your summary appears in Align after the first run.

## Good to know

- `scanStatus()` (run from the editor) logs where the pass stands; `resetScanner()` starts over with a fresh
  universe.
- The universe comes from Nasdaq Trader's symbol directory (every US listing, ETFs and test issues dropped) with
  market caps from Yahoo's quote endpoint (which needs a session cookie + crumb — if Yahoo closes that door the
  rebuild logs an error and the old universe keeps working; set `CUSTOM_UNIVERSE` to sidestep it entirely).
- "Post-earnings" is judged from Yahoo's next scheduled earnings date (companies report ~every 91 days, so right
  after a report the next date sits a quarter out). A stock with no scheduled date can't pass.
- Earnings-call sentiment is approximated by the AI's read of the verified numbers plus current headlines.
- Most passes find nothing — that's by design. The screen is picky (score ≥ 60 stored, and the Firestore doc says so
  when a pass comes up empty).

## Testing locally

- `npm test` covers the pure helpers (the stage-1 screen, the symbol-directory parser, the quoteSummary fact mapping,
  the earnings-recency check, the score with its worked example, flags, RSS parsing) in
  `tests/apps-script/market-scanner.test.ts`.
- With `npm run emulators` and `npm run seed` running, `npm run test:scanner` runs the whole script against the
  emulators with canned Yahoo / Nasdaq / news data: the universe build, the three stages, the per-member summaries
  and the published watchlists.
