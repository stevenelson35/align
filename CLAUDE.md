# Align: notes for coding agents

Household task, checklist, notes, calendar and voting app for one family. It's **live** at https://align.itsallonesong.com, and everything on `main` is deployed. Read `DESIGN.md` **§13 Status & Handoff** first: it covers current state, what's waiting on the user, next ideas, how to work on it, and gotchas.

## Commands
```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"   # Node v24 via nvm
npm install
npm run emulators      # terminal 1 (Auth + Firestore emulators, project demo-align)
npm run seed           # terminal 2: test accounts + household (password "align-dev")
npm run dev            # http://localhost:5173
npm test               # 92 unit tests (vitest: engine, tokens, parser, utils, DB writes, Apps Script helpers)
npm run test:rules     # 37 security-rule tests; starts its own emulators (stop `npm run emulators` first); must stay green
npm run test:calendar  # Apps Script calendar sync + web app against the running emulators (after seed)
npx tsc -b && npm run lint && npm run build
npm run deploy:rules   # real project align-a32c1 (firebase login is done)
ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web   # the USER runs this: it prompts for the FTP password
```

## Rules
- **Zero cost is a hard constraint:** Firebase **Spark** plan only (no Cloud Functions, no paid APIs). Logic runs in the browser. Firestore rules are the only access control. The only "server" is the user's free Google Apps Script (calendar sync).
- **Change the rules and their tests together.** Every data-model change needs rules plus tests in `tests/rules/`. **When the rules change, deploy them before the web app.**
- **Tasks copy their list's `visibility` / `ownerId` / `viewerVisible` / `sharedWith`.** Update them in the same batch as the list (`updateList`, `copiedFields` in `src/firebase/db.ts`).
- **`sharedWith` exists only on shared docs** (`visibility: 'shared'`), so "shared with me" stays one rule-provable query.
- **Every status change goes through `withStatus(task, status, day)`** (db.ts) so `finishedOn` stays right for day views; pushes record `pushedFrom`.
- **Privacy is five choices** (Only me · Parents · Family · Chosen people · Everyone; default Everyone) mapped onto the stored fields by `utils/audience.ts`; pick with `AudiencePicker`. Don't write "grandparents" in the UI.
- **Goals** are their own collection (`goals`) with a per-day `log` map. "Who can view" uses list privacy; "who can log" is `editAudience` / `editors` (rules `canLogGoal`; non-owners may change only `log`). Log with `logGoal` (that day's fields only) or `addToTotal` (running totals, `increment`).
- **The blog GitHub token lives only in each device's localStorage** (Settings); never put a token in code, Firestore, or a served page.
- **Quick-add boxes use `addTaskNow` and clear immediately** (don't await the server before clearing; it caused duplicate adds on slow phones).
- **Firestore has a persistent device cache**; sign-out clears it (`auth.ts`).
- **Icons go through `<Icon name=… />`** (`components/UI/Icon.tsx`) so the Settings icon style applies; add new drawings there (fill / line / detail layers).
- **Checklist items, notes and links are task docs** kept in `DataState.listItems`, not `tasks`. They stay out of task views, chat task commands and scheduling.
- Hash routing (static hosting on Turbify, no rewrites), including `#/task/<id>` links. No spaces in generated names.
- Match the existing style: functional React components, typed Firestore data in `src/types.ts`, small modules, comments that explain *why*, plain user-facing wording.
- Layout: pure logic lives in `src/engine/`, `src/chat/parser.ts`, `src/voting/tokens.ts` and `src/utils/` (unit-tested). Firestore access is only in `src/firebase/db.ts`. Live data comes through `DataProvider` (`useData()`), UI state through `AppContext` (`useApp()`).
- Every schedule change goes through a `ShiftPreview` → `ShiftDialog` → `applySchedule` batch.
- `scripts/apps-script/calendar-sync.gs` is plain ES5-style Apps Script (no modules). Keep its pure helpers testable from `tests/apps-script/`. The user pastes it into the Apps Script editor and redeploys it with "Manage deployments → New version" (same URL).
- **Working with the user:**
  - Commit and push (over SSH) only when asked. They usually say "commit and push, then deploy the rules".
  - They run `deploy:web` themselves, then ask you to verify the live site: grep the live `assets/index-*.js` bundle for a string from the change.
- **Check UI changes in a browser** (Playwright in a scratch folder, phone-sized viewport, against the emulators). DESIGN.md §13 "How to work on it" has the setup.
