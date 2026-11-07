# Market scanner (Apps Script)

`market-scanner.gs` powers Align's **Investing** section (on Today, in More… to start). It runs free in Google Apps
Script and writes to Firestore as the household's helper account. Each investment list has its own audience and only
its owner can edit it. Lists start private; holdings can be shared with a spouse while the Overreactions feed is shared
with a viewer separately. See DESIGN.md §5.13.

For investment lists created in Align (Investing → **+ New list**, then **Add stocks** or import an E*TRADE portfolio
CSV), it keeps two kinds of results fresh:

- **Each holdings list's summary**: price, day / week change, 52-week closing-price range, headlines, P/E and
  same-industry peers when available, plus big-move flags — a nudge to look closer, never advice.
- **Each member's Overreactions feed** (always last in the UI): a post-earnings dislocation screen over US mid-caps
  ($2B–$50B by default). Three stages:
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

In Align, open a holding or candidate and choose **Text about this** to send a note and link through your phone's
Messages app (or copy the text). Recipients must sign in and already have access to that list; use **Edit / sharing**
to choose its audience. Links open the latest stock details, not a saved report, and identify stocks no longer listed.

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

   Optional tuning: `GEMINI_MODEL` (`gemini-3.8-flash`), `MIN_CAP_B` (2), `MAX_CAP_B` (50), `MIN_DROP` (15),
   `MAX_DROP` (40), `MIN_DOLLAR_VOL_M` (10), `MIN_SCORE` (60), `EARNINGS_DAYS` (10), `SCAN_BATCH` (200),
   `CUSTOM_UNIVERSE` (a comma-separated ticker list that replaces the automatic mid-cap universe), `TIME_ZONE`.
4. **Open Investing in Align** (Today → More…): this creates your private **My investments** and **Post-earnings
   overreactions** lists. Add symbols or import an E*TRADE portfolio CSV into a holdings list. The Overreactions feed
   works even without holdings.
5. **Run it.** Pick `installTrigger` and click **Run**; authorize it (your own unpublished script: *Advanced → Go to
   Align market scanner*). That schedules a run every 4 hours and does the first slice.
6. Check **Executions**: the first runs build the ticker universe (`Universe ready: … mid-caps`), then scan slices
   (`Slice done: cursor …`), and your summary appears in Align after the first run.

## Updating an existing installation

1. Deploy Firestore rules (`npm run deploy:rules`) **before** the updated web app (`npm run deploy:web`).
2. Open Investing as each member: existing symbols and positions migrate once into **My investments**, and a separate
   **Post-earnings overreactions** list is created. Both start private. **Edit / sharing** changes a list's audience;
   sharing includes quantities, costs and scanner results, not just symbols.
3. Replace the Apps Script source with the updated `market-scanner.gs` and save. Keep existing properties and trigger;
   no web deployment, `installTrigger` rerun or `resetScanner` is needed. **Do not reset an in-progress pass.**
4. Run `scan` manually or wait for the next trigger. Holdings refresh into `investmentLists/{id}/data/summary`.
   The next completed pass writes `data/watchlist` under each owner's Overreactions list. Owners see their legacy
   results until refreshed; shared recipients do not receive legacy private results and may initially see pending data.

### Adding status while the first pass is underway

You **do not need to restart the pass**. Deploy the new rules and web app, then save the updated script in the same
Apps Script project. If a slice is executing, let that short execution finish first (each lasts at most six minutes);
the multi-day pass is held in Script Properties between slices. Keep all `SCAN_STATE.*` properties, credentials,
configuration and the existing trigger. Do **not** run `resetScanner` or reinstall the trigger.

Select **`scanStatus` → Run** to send the existing universe, cursor and pending-candidate count to Align immediately.
It reads the saved state without changing any state-property bytes, fetching holdings or advancing the scan.
Otherwise, the next scheduled `scan` publishes status automatically and resumes from that same cursor.

Each expanded list shows the phase, phase-specific progress, queued candidates, last published pass, and expandable
**Last slice and data quality** details. Percentages describe universe sizing or price screening, **not** overall
completion: 100% price screening may still leave fundamentals and reports to finish. A full pass shows the number
of price checks, qualified candidates and retained reports. Holdings show their own refresh timestamp, stock count,
price failures and valuation issues. Source failures are skipped, not confirmed screen rejections.

Status is checkpointed during price/analysis work and at slice boundaries. An execution timeout can leave a
"running" checkpoint; Align warns after ten minutes without a finish, or eight hours without other activity.
Check **Executions** if that happens. Old runs' timestamps and failure counts cannot be reconstructed; counts added
partway through a pass explicitly start at the tracking date. Status respects each list's sharing.

The scanner still handles unmigrated `investing/{uid}` accounts; once a member has new lists it uses those instead.

## Valuation context

- Expanded stock details show trailing and forward P/E, reported industry, distance from the 52-week closing high
  and position within the closing-price range. Historical prices are not intrinsic valuation or historical P/E.
- Peer comparisons require **three other stocks in that same list**, with the exact same reported industry and
  positive, finite forward P/E. The subject is compared with their median. No private lists are combined, and this
  is not an industry-wide peer screen. ETFs, losses and missing data may have no meaningful comparison.
- Yahoo valuation failures are logged and shown explicitly. These unofficial endpoints can change or rate-limit.
  Forward earnings are estimates, and AI scores / recovery estimates are uncalibrated, not measured probabilities.
- Trailing P/E comes from `summaryDetail.trailingPE` (or key statistics), with price / trailing EPS as a fallback;
  forward P/E comes from key statistics or `summaryDetail.forwardPE`. Results now include a valuation lookup timestamp.
  **Not supplied in this result** is different from **not meaningful (non-positive)**. A failing HTTP lookup shows
  the source error; a successful response with missing fields says which ratio Yahoo omitted.
- A pending candidate scan does **not** block holdings P/E: summaries refresh before candidate work on each run.
  Old scanner versions did not fetch holdings P/E at all, so saved price data may have no valuation fields. Updating
  the script fixes the incomplete field lookup but cannot guarantee Yahoo availability. After saving, run
  **`checkValuation`** to test KMB's public lookup and read the result/error in Executions without touching scan state;
  the next normal slice refreshes holdings in Align.
- Each list supports 100 followed symbols and 200 positions; only the first 100 distinct combined symbols refresh
  per run, with an explicit summary note if that limit is exceeded.

## Good to know

### Checking Gemini separately

In Apps Script, click **Executions** in the left sidebar, then click a completed execution to read its **Cloud logs**.
Stage-1 messages and `Slice done: cursor 800/1706, 85 passers waiting, 0 scored` mean price screening is still underway;
Gemini runs only after the cursor reaches the universe size, during candidate analysis. Look at executions from the
previous completed pass for `Gemini call failed`, not just the latest price-screening slice.

To test without waiting for a pass:

1. Save this updated source in the **same** Apps Script project. Keep all properties and the trigger; do not reset.
2. Open **Editor**, choose **checkGemini** in the function dropdown, then click **Run**.
3. Read the **Execution log** below the editor, or the new entry in **Executions**. Success logs the model, report
   character count, and a synthetic test note. Failure shows the API error (including HTTP status), invalid JSON,
   empty report, or response finish/block reason. Never share your API key.

If the API returns 404 saying `gemini-2.5-flash` is no longer available to new users, set **GEMINI_MODEL** to
**gemini-3.8-flash** in Script properties and run `checkGemini` again. An explicit property overrides the source's
default, so updating the source alone does not replace an old model property. Preserve scan state and the trigger.
The model change's actual API access and free-tier quota must be confirmed in your Apps Script account.

The test makes one request using the configured `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-3.8-flash`).
It uses synthetic company facts, consumes the API's applicable quota, and does not access Yahoo, Firestore, or
scanner state. It does not replace missing reports on existing results; a future normal analysis must generate them.

- A watchlist is published after the full configured universe has been price-screened and its queued passers
  analyzed. It keeps up to **10 highest-scoring qualifying candidates**, not the first 10 found. Source failures
  are skipped, so this is a ranking of successfully evaluated candidates, not a guarantee of complete data coverage.
- Each retained candidate can have a one-page Gemini note. Without `GEMINI_API_KEY`, or if Gemini fails or returns
  no report text, only screening facts and the automated-research disclaimer are available. Check **Executions**
  for `Gemini call failed` and verify the key/model properties. The disclaimer is not itself a generated report.

- `scanStatus()` (run from the editor) publishes/logs saved progress without advancing it; `resetScanner()` starts over with a fresh
  universe.
- `scan()` advances one slice immediately. The watchlist publishes only after the whole universe and scoring queue
  finish, not after each slice. At 200 symbols per four-hour run, 1,706 symbols need at least nine scanning runs plus
  scoring; run slices manually to advance sooner. An empty published pass is different from “never published.”
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
  and the published watchlists. It also verifies an old mid-pass checkpoint survives `scanStatus` byte-for-byte,
  the next slice starts at its saved cursor, telemetry failures preserve the pass, and P/E/source errors are explicit.
