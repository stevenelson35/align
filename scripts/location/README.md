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
