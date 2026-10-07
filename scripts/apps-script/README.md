# Google Calendar sync (Apps Script)

`calendar-sync.gs` copies every event from the family Google Calendar into Align's **Family Calendar** list, every hour. It runs free in Google Apps Script under your Google account and writes to Firestore as a dedicated "calendar bot" household member, so the normal security rules apply. See DESIGN.md §5.5.

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
5. **Run it.** In the editor, pick `installHourlyTrigger` and click **Run**. Google asks you to authorize. Because it's your own unpublished script, you'll see "Google hasn't verified this app": choose *Advanced → Go to Align calendar sync*. The run does a first sync and schedules one every hour.
6. Check **Executions** for a line like `Synced 23 events: 23 new, 0 changed, 0 removed.` To let grandparents see the calendar, open the list in Align → **Edit list** → *Visible to viewers*.

To update the script later, paste the new `calendar-sync.gs` over `Code.gs`. The trigger keeps working.

## Testing locally

- `npm test` covers the pure helpers (event → task mapping, sync planning, Firestore value encoding).
- With `npm run emulators` and `npm run seed` running, `npm run test:calendar` runs the whole script against the emulators. Fake calendar events go through a move, a cancellation and a no-op re-sync.
