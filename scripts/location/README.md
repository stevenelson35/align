# Family map (OwnTracks → Align)

Each phone runs the free **OwnTracks** app, which reports its location in the background (battery-friendly: it
reports real moves, not a constant stream). It posts to `owntracks.php` on the Align site, which passes each report on
to the family's Google Apps Script web app — the same script and URL as "Refresh calendar" and Alexa — which writes
`locations/{uid}` in Firestore as the household's helper account.
Align's **Family map** (menu → Family map, members only) shows everyone on an OpenStreetMap map. Nothing costs money.

## 1. Update the Apps Script (once)
1. Paste `scripts/apps-script/calendar-sync.gs` over the code at script.google.com.
2. The personal links are signed with the Script Property `VOICE_SECRET` (already there for Alexa). To use a
   separate secret, add `LOCATION_SECRET`; changing it later cuts off every phone until each person sets up again.
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (same URL).

## 2. Deploy the rules, then the web app
`firebase deploy --only firestore:rules` (adds `locations`), then `deploy:web`. The build writes `dist/owntracks.php`
(the relay, from `owntracks-relay.php`) with `VITE_CALENDAR_SYNC_URL` filled in, and the upload puts it next to
`index.html`. Check it runs: `curl -i https://align.itsallonesong.com/owntracks.php` should answer `405` with `[]`, not
show PHP source.

## 3. Each person, on their phone
1. Open Align → menu → **Family map** → **Set up my phone**.
2. Install OwnTracks ([iPhone](https://apps.apple.com/app/owntracks/id692424691),
   [Android](https://play.google.com/store/apps/details?id=org.owntracks.android)).
3. Back in Align on the phone, tap **Set up OwnTracks** (fills in HTTP mode and the personal URL), and allow
   location **Always** / **Allow all the time**.
4. In OwnTracks, tap the upload (publish) button once to send a first report; the map shows it within seconds.

By hand instead: OwnTracks → Preferences → Connection → Mode **HTTP**, URL = the personal link from "Set it up by hand
instead" (`…/owntracks.php?loc=<uid>.<signature>`). Monitoring "Significant" saves battery; "Move" reports every few
seconds while travelling.

## How it works
- The personal key is `uid.HMAC(secret, "location:"+uid)`, made by the script after it checks the person's Align
  sign-in; it can only post that person's location. Align never sees the secret.
- Phone setup uses the same relay URL for Android and iPhone. The script reuses a short-lived Firebase bot token
  rather than signing in with a password for every report; deploy a new version of `calendar-sync.gs` to use this.
- `location_` keeps the latest point (lat, lon, accuracy, battery, time) and the last 24 hours (≤100 points) of trail.
- **Pause sharing** sets `off: true`; the script then ignores that phone, and the rules stop the helper account from
  writing it or unpausing it. **Delete my location** removes the document.
- **Why the relay:** Apps Script answers every POST with a 302 redirect to its response. OwnTracks for iPhone doesn't
  follow redirects, so it counts every send as failed ("HTTP Response error 302"): the report stays first in its queue
  and is resent forever, and the map shows that first report (its time never changes) no matter where the phone goes.
  `owntracks.php` posts to the script itself, follows the redirect and answers 200, so the phone moves on. It only
  posts to the one built-in URL, accepts only `?loc=` keys shaped like `uid.<32 hex>`, and caps reports at 64 KB.
  It answers 502 (OwnTracks retries later) when the script fails or is busy, and 403 (OwnTracks drops the report and
  shows the error) for a link the script doesn't recognize. It uses curl, or PHP's own HTTP client without it.
- **Phones set up before the relay** post to the script directly. Android copes, but an iPhone gets stuck as above:
  open Align → Family map → **Set up another phone** → **Set up OwnTracks** on that phone to switch it to the relay.
  Its queued reports then go through, oldest first, and the map catches up.
- **Catching up:** OwnTracks for iPhone only sends saved reports while it's running, so a phone with a backlog (the red
  number on its icon) must keep OwnTracks open until the number is gone. Reports older than 15 minutes
  (`ALERT_MAX_AGE_MS`) still update the map and its "Arrived …" history, but send no alerts.

## Places and alerts (optional)
**Places** (geofences): Family map → Places → **+ Add place**. Name it, then set the center with **Here** (where the
device you're holding is), **Tap the map**, dragging the pin, or typing an address (looked up with OpenStreetMap's
free geocoder) or `lat, lon`. Pick a radius (150 m or more works best: phones report every few hundred meters of
travel). The Apps Script checks each report against the places: the map shows "at School" and "Arrived at School
3:05 PM", and leaving needs a margin beyond the radius so a fix wobbling at the edge doesn't flap. No alert on the first
report, for a place just added, or from a fix worse than 500 m.

**Alerts for me**: "Alert me when Daughter arrives at School" (anyone / one person; arrives / leaves / both; any place
/ one place). Only you see your alerts; you're never alerted about yourself. They're delivered by:
- **Email** (works right away): tick "Also email me at …". The Apps Script sends it from the Google account that runs
  it, so the first time it asks again for permission (to send email). Set the Script Property `ALIGN_URL`
  (e.g. `https://align.itsallonesong.com/`) to include a link to the map.
- **Notifications on this device**: Android (Chrome) works in the browser or installed; iPhone needs Align added to the
  Home Screen first (Share → Add to Home Screen, iOS 16.4+) and opened from there. One-time setup:
  1. Firebase console → Project settings → **Cloud Messaging** → Web Push certificates → **Generate key pair**. Put the
     key in `.env.production.local` as `VITE_FIREBASE_VAPID_KEY=…` (public; `VITE_FIREBASE_MESSAGING_SENDER_ID` is
     already there), then `deploy:web`.
  2. Firebase console → Project settings → **Service accounts** → **Generate new private key**. Open the downloaded
     JSON file, copy all of it into a Script Property `FCM_SERVICE_ACCOUNT`, and delete the file. (It's a secret: it
     stays in the Apps Script's properties, never in the repo or the site.)
  3. Paste the new `calendar-sync.gs`, deploy a new version. Then on each phone: Family map → Alerts for me →
     **Turn on here**.

## Bad fixes (filtered for every phone)
Phones sometimes report a cell-tower or Wi-Fi position kilometers off, or a one-off jump. The Apps Script checks each
report before saving it (`locationVerdict_`), so Android, iPhone and the web all see the same clean data:
- **Poor accuracy:** a fix accurate only to more than 250 m is ignored while the last good fix is under 30 minutes
  old (after that, a rough position beats a stale one; the map shows it faded with a dashed circle, "rough position").
- **Impossible jumps:** a fix implying more than 70 m/s (~155 mph), after allowing for both fixes' accuracy, is held
  aside (`pending`; nothing on the map moves). If the next fix agrees with it, the jump was real (a flight, a phone off
  for a while) and both are kept; otherwise it's dropped.
- **(0, 0)** fixes are dropped.
- The map also tidies trails saved before this (`cleanTrail`): poor-accuracy points and one-point spikes are hidden.
- Script Properties `LOCATION_MAX_ACCURACY` (meters) and `LOCATION_MAX_SPEED` (m/s) change the limits.
