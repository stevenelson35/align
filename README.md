# Align

Household task manager for the Nelson family. See [DESIGN.md](DESIGN.md) for the full spec. Its §13 "Status & Handoff" says where things stand, and [CLAUDE.md](CLAUDE.md) has notes for coding agents.

React + TypeScript + Vite in the browser, with Firebase Auth and Firestore on the free Spark plan. The app is static files hosted on Turbify at align.itsallonesong.com.

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
npm test            # unit tests
npm run test:rules  # Firestore security rules, against the emulator
npm run lint
```

## Deploying

1. Copy `.env.example` to `.env.production.local` and fill in the Firebase web app config.
2. `firebase use --add` to select the real project, then `npm run deploy:rules`.
3. `npm run build`, then upload the contents of `dist/` to the Turbify subdomain's document root.
