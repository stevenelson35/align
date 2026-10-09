# Align: notes for coding agents

Household task and scheduling app for one family. Read `DESIGN.md`, especially **§13 Status & Handoff**, before starting. The MVP (stages 1–6) is built; stage 7 (first deploy) waits on the user's Firebase/Turbify setup.

## Commands
```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"   # Node v24 via nvm
npm install
npm run emulators      # terminal 1 (Auth + Firestore emulators)
npm run seed           # terminal 2: test accounts + household (password "align-dev")
npm run dev            # http://localhost:5173
npm test               # unit tests (vitest, src/)
npm run test:rules     # 22 security-rule tests against the emulator; must stay green
npm run test:calendar  # Apps Script calendar sync against the running emulators (after seed)
npm run build && npm run lint
npm run deploy:rules   # real project (after firebase login + firebase use)
ALIGN_FTP_DIR=/<docroot> npm run deploy:web   # build + FTPS upload to Turbify (prompts for password)
```

## Rules
- **Zero cost is a hard constraint:** Firebase **Spark** plan only (no Cloud Functions, no paid APIs). Logic runs in the browser; Firestore rules are the only access control.
- **Change the rules and their tests together.** Every data-model change needs rules plus tests in `tests/rules/`.
- **Tasks copy their list's `visibility` / `ownerId` / `viewerVisible`.** Update them in the same batch as the list.
- Hash routing (static hosting on Turbify, no rewrites). No spaces in generated names.
- Match the existing style (functional React components, typed Firestore data in `src/types.ts`, small modules). Commit and push over SSH when the user asks.
- Layout: pure logic in `src/engine/`, `src/chat/parser.ts`, `src/voting/tokens.ts`, `src/utils/` (unit-tested). Firestore access only in `src/firebase/db.ts`. Live data via `DataProvider` (`useData()`), UI state via `AppContext` (`useApp()`).
- Every schedule change goes through a `ShiftPreview` → `ShiftDialog` → `applySchedule` batch.
- `scripts/apps-script/calendar-sync.gs` is plain ES5-style Apps Script (no modules). Keep its pure helpers testable from `tests/apps-script/`.
