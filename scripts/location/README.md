# Family map (OwnTracks → Align)

Each phone runs the free **OwnTracks** app, which reports its location in the background (battery-friendly: it
reports real moves, not a constant stream). It posts to the family's Google Apps Script web app — the same script and
URL as "Refresh calendar" and Alexa — which writes `locations/{uid}` in Firestore as the household's helper account.
Align's **Family map** (menu → Family map, members only) shows everyone on an OpenStreetMap map. Nothing costs money.

## 1. Update the Apps Script (once)
1. Paste `scripts/apps-script/calendar-sync.gs` over the code at script.google.com.
2. The personal links are signed with the Script Property `VOICE_SECRET` (already there for Alexa). To use a
   separate secret, add `LOCATION_SECRET`; changing it later cuts off every phone until each person sets up again.
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (same URL).

## 2. Deploy the rules, then the web app
`firebase deploy --only firestore:rules` (adds `locations`), then `deploy:web`.

## 3. Each person, on their phone
1. Open Align → menu → **Family map** → **Set up my phone**.
2. Install OwnTracks ([iPhone](https://apps.apple.com/app/owntracks/id692424691),
   [Android](https://play.google.com/store/apps/details?id=org.owntracks.android)).
3. Back in Align on the phone, tap **Set up OwnTracks** (fills in HTTP mode and the personal URL), and allow
   location **Always** / **Allow all the time**.
4. In OwnTracks, tap the upload (publish) button once to send a first report; the map shows it within seconds.

By hand instead: OwnTracks → Preferences → Connection → Mode **HTTP**, URL = the personal link from "Set it up by hand
instead" (it ends in `?loc=<uid>.<signature>`). Monitoring "Significant" saves battery; "Move" reports every few
seconds while travelling.

## How it works
- The personal key is `uid.HMAC(secret, "location:"+uid)`, made by the script after it checks the person's Align
  sign-in; it can only post that person's location. Align never sees the secret.
- `location_` keeps the latest point (lat, lon, accuracy, battery, time) and the last 24 hours (≤100 points) of trail.
- **Pause sharing** sets `off: true`; the script then ignores that phone, and the rules stop the helper account from
  writing it or unpausing it. **Delete my location** removes the document.
- Apps Script answers every POST with a redirect; the report is saved before the redirect, so even if a phone shows a
  connection warning, check the map before troubleshooting.

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
