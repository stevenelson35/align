# Align on Alexa (voice)

Say **"Alexa, ask sir georgie to add buy milk"** (added to the Family Inbox, due today) or
**"Alexa, ask sir georgie what's on today"** (reads today's calendar and to-dos).

How it works: an Alexa-hosted skill (free) sends what you said to Align's Google Apps Script web app (the same script
and URL as "Refresh calendar"), which adds the task as its calendar-helper member. A shared **voice secret** keeps
anyone else from using it. Nothing here costs money.

## 1. Update the Apps Script (about 3 minutes)
1. Open the Align calendar script in [script.google.com](https://script.google.com).
2. Replace the code with `scripts/apps-script/calendar-sync.gs` from this repo (it adds the voice part).
3. **Project Settings → Script Properties → Add script property**: `VOICE_SECRET` = your secret (a long random text).
4. **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.** The URL stays the same.

## 2. Create the skill (about 10 minutes)
1. Go to [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask) and sign in with the
   **same Amazon account as your Echo**.
2. **Create Skill** → name **Align**, locale English (US) → type **Custom** → hosting **Alexa-hosted (Node.js)** →
   template **Start from scratch** → Create. (It takes a minute.)
3. **Build** tab → **Interaction Model → JSON Editor** → paste `interactionModel.json` → **Save** → **Build skill**.
4. **Code** tab → replace `index.js` with `lambda/index.js` and `package.json` with `lambda/package.json`. In
   `index.js`, fill in `WEB_APP_URL` (your Apps Script web app URL, ends in `/exec`) and `VOICE_SECRET`. **Deploy**.
5. **Test** tab → set "Skill testing is enabled in" to **Development**. Type or say
   *"ask sir georgie what's on today"*, then *"ask sir georgie to add test from Alexa"* (check Align's Family Inbox).

Development skills work on every Echo signed in to that Amazon account; there's no need to publish it.

## Changing it later
- What you can say: `interactionModel.json` (then Build again). The words go to `voice_` in the Apps Script.
- Another phrase to start it: change `invocationName` (two or more words, e.g. "sir georgie").
