# Align

Household task manager for the Nelson family, live at https://align.itsallonesong.com. It holds:
- task lists and projects (dependencies, timeline)
- checklists and notes
- the family Google Calendar
- voting boards
- texting family members about a task

See [DESIGN.md](DESIGN.md) for the full spec. Its §13 "Status & Handoff" says where things stand, and [CLAUDE.md](CLAUDE.md) has notes for coding agents.

React + TypeScript + Vite in the browser, with Firebase Auth and Firestore on the free Spark plan. The app is static files hosted on Turbify. The calendar sync runs as a free Google Apps Script (`scripts/apps-script/`).

## Local development

Requires Node LTS (via nvm), Java 21 (for the Firebase emulators), and `npm install -g firebase-tools`.

```sh
npm install
npm run emulators   # terminal 1: Auth + Firestore emulators, UI at http://127.0.0.1:4000
npm run seed        # terminal 2: test accounts + household (password "align-dev")
npm run dev         # terminal 2: app at http://localhost:5173
```

Test accounts: `steve@`, `wife@`, `daughter@` (members) and `grandparent@` (viewer), all `@example.com`.

## Tests

```sh
npm test               # unit tests
npm run test:rules     # Firestore security rules (starts its own emulators)
npm run test:calendar  # calendar sync script against the running emulators (after seed)
npm run lint
```

## Deploying

1. Copy `.env.example` to `.env.production.local` and fill in the Firebase web app config (and `VITE_CALENDAR_SYNC_URL` for the Refresh calendar button).
2. `firebase login --no-localhost`, `firebase use --add` (pick the `align` project), then `npm run deploy:rules`. **When the rules change, deploy them before the web app.**
3. `ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web` builds and uploads `dist/` to Turbify over FTPS. It asks for the FTP password, so run it in a terminal. To preview without changing anything, run `npm run build` and then `ALIGN_FTP_DIR=... scripts/deploy-turbify.sh --dry-run`.
4. First visit: sign in and complete the one-time household setup screen. Calendar sync setup is in `scripts/apps-script/README.md`.
