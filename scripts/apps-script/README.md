# Google Calendar sync (Apps Script)

`calendar-sync.gs` copies every event from the family Google Calendar into Align's **Family Calendar** list every 15 minutes, and on demand from Align's **↻ Refresh calendar** button (optional, below). It runs free in Google Apps Script under your Google account and writes to Firestore as a dedicated "calendar bot" household member, so the normal security rules apply. See DESIGN.md §5.5.

- One-way: the calendar owns each imported task's title, dates, time and location. Status, priority, notes, assignee, "for" and dependencies are the family's to edit, and the sync never touches them.
- Window: 7 days back through 8 weeks ahead. Each instance of a repeating event becomes its own task.
- Moved events update their task in place. Cancelled events disappear, but only within the window, so past history stays.

## One-time setup

1. **Bot account.** In the Firebase console → Authentication → Users → **Add user**:
   - Email: e.g. `calendar-bot@itsallonesong.com`. It doesn't need a real mailbox.
   - Password: a long random one.

   Copy its **User UID**.
2. **Make it a household member.** Firestore Database → `household` → `main` → `members` → **Add field**:
   - Name: the bot's UID. Type: **map**, with these entries:
     - `role` (string) `member`
     - `displayName` (string) `Calendar`
     - `color` (string) `#57606a`
     - `bot` (boolean) `true`

   The `bot` flag hides it from people pickers.
3. **Create the script.** Go to https://script.google.com, signed in with the Google account that can see the family calendar. Click **New project** and name it `Align calendar sync`.
   - Replace the contents of `Code.gs` with `calendar-sync.gs`.
   - ⚙️ Project Settings → tick **Show "appsscript.json" manifest file in editor**. Replace that file with `appsscript.json` from this folder, keeping your own `timeZone` line. This turns on the Google Calendar API service and limits the script to **read-only** calendar access.
4. **Script properties.** ⚙️ Project Settings → Script properties → add:

   | Property | Value |
   |---|---|
   | `CALENDAR_ID` | Google Calendar → Settings → the family calendar → Integrate calendar → Calendar ID |
   | `FIREBASE_API_KEY` | the web app's `apiKey` (same as `.env.production.local`) |
   | `FIREBASE_PROJECT_ID` | `align-a32c1` |
   | `BOT_EMAIL` | the bot's email |
   | `BOT_PASSWORD` | the bot's password |

   Optional: `WEEKS_AHEAD` (default 8), `DAYS_BEHIND` (7), `LIST_NAME` ("Family Calendar"), and `TIME_ZONE`. `TIME_ZONE` is an IANA name such as `America/New_York`; it defaults to the `timeZone` in `appsscript.json`. `LIST_ID` fills itself in.

   Times are shown in that zone, not the calendar's own zone setting. A calendar set to UTC would otherwise show 4 PM events as 8 PM. Each run logs the zone it used.
5. **Run it.** In the editor, pick `installTrigger` and click **Run**. Google asks you to authorize. Because it's your own unpublished script, you'll see "Google hasn't verified this app": choose *Advanced → Go to Align calendar sync*. The run does a first sync and schedules one every 15 minutes.
6. Check **Executions** for a line like `Synced 23 events: 23 new, 0 changed, 0 removed.` To let grandparents see the calendar, open the list in Align → **Edit list** → *Visible to viewers*.

To update the script later, paste the new `calendar-sync.gs` over `Code.gs`. The trigger keeps working. (If you set it up before the 15-minute schedule, run `installTrigger` once to switch from hourly. `installHourlyTrigger` still exists and does the same thing.)

## Optional: the "↻ Refresh calendar" button

Align can ask the script to sync right away. The button appears on **Today** and on the **Family Calendar** list once Align knows the script's web address. It's free: the script runs as a small Google "web app".

**Who can use it:** the script checks the Firebase sign-in that Align sends, and that the account is in the household. Anyone else gets "Only household members can refresh the calendar." A second tap within a minute is skipped, and a tap during a scheduled sync waits for it rather than overlapping.

1. **Paste the latest script.** In the Apps Script editor, replace `Code.gs` with the current `calendar-sync.gs` and save (💾).
2. **Switch to the 15-minute schedule** (once): pick `installTrigger` in the function menu and click **Run**.
3. **Publish it as a web app:** **Deploy → New deployment**. Click the ⚙ next to "Select type" and choose **Web app**. Then:
   - Description: `Align refresh`
   - **Execute as: Me** (your account, which can read the calendar)
   - **Who has access: Anyone**. Align's request comes from the browser without a Google login, so this must be "Anyone"; the script does its own household check.

   Click **Deploy**. If Google asks to authorize again, allow it (same *Advanced → Go to Align calendar sync* steps as before).
4. **Copy the Web app URL.** It looks like `https://script.google.com/macros/s/AKfy…/exec`.
5. **Give it to Align:** add a line to `.env.production.local` in the align repo: `VITE_CALENDAR_SYNC_URL=https://script.google.com/macros/s/…/exec`. Then rebuild and upload: `ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web` (in a terminal, for the password prompt).
6. **Try it:** in Align, open **Today** and tap **↻ Refresh calendar**. You'll see "Calendar refreshed: N new, N changed, N removed" or "Calendar is up to date".

**Event links (2026-10-10):** the script also saves each event's Google Calendar link, so an event's task panel in Align can open the event itself. After you deploy this version, the next sync adds the link to every imported event (a one-time update of each one).

**Updating the script later:** after pasting new code, use **Deploy → Manage deployments → ✏ (edit) → Version: New version → Deploy**. That keeps the same URL. A *New deployment* would give a new URL, which you'd then have to put in `.env.production.local` again.

## Testing locally

- `npm test` covers the pure helpers (event → task mapping, sync planning, Firestore value encoding).
- With `npm run emulators` and `npm run seed` running, `npm run test:calendar` runs the whole script against the emulators. Fake calendar events go through a move, a cancellation and a no-op re-sync, then the web app's `doPost` is called with real emulator sign-ins: a member (syncs), a quick second tap (skipped), an invalid token, an account outside the household, no sign-in, and a tap during a running sync.
