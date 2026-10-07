# Align — Design Specification

Align is a household task manager for one family. It handles personal, shared and project tasks, does dependency-aware scheduling, runs token-based family voting, and has a chat box that accepts simple typed commands.


> **Picking this project up later, or handing it to another agent?** Start with **§13 Status & Handoff**. It covers what's built, what's next, what the user still has to set up, the environment, and gotchas. `CLAUDE.md` has the short version for coding agents.
## 1. Constraints

These rules override anything else in this document.

1. **No added cost.** Only free tiers:
   - Firebase **Spark** (free) plan. **No Cloud Functions** (they need the paid Blaze plan).
   - No paid APIs. Chat uses a local command parser, not an AI service.
   - Hosting on the existing Turbify web-hosting plan.
2. **Static hosting only.** The app is a single-page app: HTML, CSS and JS built into `dist/` and uploaded to Turbify at **https://align.itsallonesong.com**. It needs no server code.
3. **Browser-only logic.** Scheduling, vote totals and command parsing all run in the browser. Firestore security rules are the only access control.
4. **Household scale.** 3 active users and a few read-only viewers, with hundreds of tasks, not thousands. Choose simplicity over scalability.
5. **Trust model.** Users are family. Rules block outsiders and viewers, and each user can edit only their own private data. Rules don't try to stop a family member from gaming token counts.

## 2. Users and Roles

| Person | Household role | Access |
|---|---|---|
| Steve | `member` | Full |
| Wife | `member` | Full |
| Daughter (9) | `member` | Full. Same permissions and login type as the adults. |
| Grandparents, sisters (future) | `viewer` | Read-only. Sees only family lists and boards marked *visible to viewers*. |

- The household has **2 dogs, 2 cats, a bird and a fish**. They aren't users, but they can be a task's `for` target (§5.3).
- **No public sign-up.** Accounts (email/password) are created by hand in the Firebase console and added to the `household` document with a role. The app has a sign-in screen only.
- Anyone who signs in but isn't in `household.members` sees nothing. The rules enforce this.

## 3. Scope

### 3.1 MVP (use cases 1–7)

1. **Personal task management.** Private lists for chores, errands, work, lawn care and reminders. Create, edit, complete and prioritize tasks. View them by date, priority or dependency order.
2. **Shared family tasks.** Family lists that every member can edit, for household chores, family projects, travel and weekend plans. Updates sync in real time.
3. **Project tasks.** Lists marked as projects (lawn & garden, home renovation, vet business, long-term planning), with dependencies, automatic scheduling, a timeline and conflict warnings.
4. **Dependency and scheduling engine.** A DAG of tasks with day offsets (§6).
5. **Voting and tokens.** Family boards with weekly tokens that **roll over** (§7).
6. **Combined view.** All private and family tasks in one place, color-coded, with filters and sorting (§8).
7. **Chat commands.** Typed commands for common actions (§9).

Multi-device access and mobile layout come free with Firestore sync and a responsive UI, so they're part of the MVP.

### 3.2 Future ideas (not MVP, but don't design them out)

- Screens for managing viewer accounts
- Google sign-in
- Reminders and notifications (web push is free, but it needs a service worker)
- Recurring tasks, such as watering schedules and monthly flea meds
- Voting on tasks and a "voting weight" sort for tasks
- Offline-first caching (Firestore offline persistence)
- Capacitor wrapper for Android/iOS
- Google Calendar export (read-only `.ics`)

## 4. Architecture

```
Browser (React + TypeScript + Vite SPA)
  ├─ UI components
  ├─ Scheduling engine (pure TS, unit-tested)
  ├─ Command parser (pure TS, uses chrono-node for dates)
  └─ Firebase JS SDK ──► Firebase (Spark): Auth + Firestore + Security Rules

Turbify: serves static files from dist/ at align.itsallonesong.com
```

- **Routing:** use hash routing (`/#/tasks`) so Turbify needs no rewrite rules.
- **Firebase config** sits in the client bundle. That's normal and safe; the security rules protect the data.
- **Authorized domains:** add `align.itsallonesong.com` (and `localhost`) in Firebase Auth settings.
- The subdomain must have HTTPS.

## 5. Data Model (Firestore)

### 5.1 `household/main`

A single document.

```ts
{
  name: "Nelson Household",
  members: { [uid]: { role: "member" | "viewer", displayName: string, color: string } },
  pets: [{ id: string, name: string, kind: "dog" | "cat" | "bird" | "fish" }],
  weeklyTokens: number,        // default 10
  tokenStartDate: Timestamp,   // first grant week
}
```

### 5.2 `lists/{listId}`

```ts
{
  name: string,
  kind: "list" | "project",
  visibility: "private" | "family",
  ownerId: uid,
  viewerVisible: boolean,       // family lists only
  defaultContext: "family" | "work",
  createdAt, updatedAt
}
```

### 5.3 `tasks/{taskId}`

```ts
{
  listId: string,
  // Copied from the list so that queries and rules don't need a lookup:
  visibility: "private" | "family",
  ownerId: uid,
  viewerVisible: boolean,

  title: string,
  notes?: string,
  priority: 1 | 2 | 3,              // 1 = high
  status: "todo" | "doing" | "done",
  context: "family" | "work",       // e.g. vet business = work
  assigneeId?: uid,
  for?: string[],                   // member uids and/or pet ids

  startDate?: string,               // "YYYY-MM-DD" (days only)
  durationDays: number,             // default 1
  targetDate?: string,              // deadline, "YYYY-MM-DD"
  dependsOn: [{ taskId: string, offsetDays: number }],
  conflict?: string,                // set by the engine, e.g. "starts before prerequisite"

  createdBy: uid, createdAt, updatedAt
}
```

- Dependencies are stored **only** in `dependsOn`. There's no separate collection.
- If a list's visibility or owner changes, the client updates the copied fields on its tasks in one batch.

### 5.4 Voting

```
boards/{boardId}                        { name, viewerVisible, createdAt }
boards/{boardId}/items/{itemId}         { title, category?, status: "open" | "chosen" | "archived", createdBy, createdAt }
boards/{boardId}/items/{itemId}/votes/{uid}   { uid, tokens: number, updatedAt }
```

- Starter boards: **Movies & Shows**, **Restaurants & Meals**, **Weekend Activities**, **Travel Plans**. Members can add more.
- Totals are **computed in the client** from the `votes` subcollection. Nothing stores them.

### 5.5 Google Calendar import

The family Google Calendar is copied one way into a family list named **Family Calendar** by `scripts/apps-script/calendar-sync.gs`. Setup steps are in that folder's README.

- **Runs in Google Apps Script** (free) under the account that can see the calendar, on an hourly trigger. Align itself still has no server code.
- **Auth:** the script signs in to Firebase Auth's REST API as a dedicated **calendar-bot** account. That account is a normal `member` in `household/main`, with `bot: true` so the UI hides it from people pickers. The security rules apply to it unchanged.
- **Reads** use the Advanced Calendar service (`Calendar.Events.list`, `singleEvents: true`, read-only scope). Event ids are stable when an event moves, and each instance of a recurring event has its own id.
- **Each event becomes a task with id `gcal_<eventId>`:**
  - `startDate` and `durationDays` follow the event; all-day ends are exclusive, and timed events use the calendar's time zone.
  - `calendar: { eventId, time?, location? }` holds the event details.
  - New tasks get the list's copied fields, `priority: 2`, `status: "todo"`, and `createdBy` set to the bot.
- **The sync owns `title`, `startDate`, `durationDays` and `calendar`.** Updates use an update mask limited to those fields, so status, notes, priority, assignee, `for` and dependencies set in Align survive.
- **Time zone:** times and dates use the `TIME_ZONE` script property, or else the script's zone from `appsscript.json`. They never use the calendar's own zone setting: the family calendar turned out to be set to UTC, which showed 4 PM events as 8 PM.
- **Removals:** an imported task whose event is gone is deleted only if its date falls inside the sync window (7 days back to 8 weeks ahead). Tasks family members add to the list by hand are never touched.

## 6. Scheduling Engine

The engine is pure TypeScript with no Firebase dependency, so it's easy to unit test.

### 6.1 Rules

- Dates are whole days.
- `finish = startDate + durationDays - 1`
- A dependency `{ taskId: A, offsetDays: n }` on task B means that **B may start n days after A finishes**. So `earliestStart(B) = max(finish(A) + 1 + n)` across all of B's prerequisites.
  - Example: "Apply fertilizer" depends on "Armyworm treatment #2" with `+2`.
- **Cycles are rejected** when a dependency is added.
- A dependency may point to a task in another list, as long as the user can read it.

### 6.2 Conflicts

A task is in conflict when either is true:

- `startDate < earliestStart`: it starts too soon after a prerequisite.
- `finish > targetDate`: it misses its deadline.

Double-booking of a person is **not** checked.

### 6.3 Shifting

Shifting always shows a **preview** first. Then it applies the changes as one batched write.

- **Forward (push):** when a task moves later or grows longer, dependent tasks move later only as far as needed to satisfy their offsets.
- **Backward (pull), "meet new date":** when a task must finish by a date, its prerequisites move earlier only as far as needed.
- The engine changes only tasks the current user can edit. Any other affected task gets a conflict flag instead.

### 6.4 Timeline view

- Horizontal bars run from `startDate` to `finish`, with arrows for dependencies labeled with their offset (`+2d`).
- Dragging a bar starts a forward shift preview.
- Tasks in conflict are outlined in red.

## 7. Voting and Tokens

- Each member earns `weeklyTokens` every week, counted from `tokenStartDate`. **Unused tokens roll over** with no cap.
- `balance = weeklyTokens × weeksElapsed − Σ(my votes on items with status open or chosen)`
- Tokens can be moved or withdrawn while an item is `open`.
- When an item is marked **chosen** (we watched the movie), its tokens are **spent**.
- When an item is **archived** without being chosen, its tokens come back.
- Ranking sorts items by total tokens. The per-user bar shows each member's share.
- The client blocks overspending. The rules only check that users write their own vote document and that `tokens` is a whole number of 0 or more. This relies on the trust model in §1.

## 8. Combined View

- Shows all readable tasks: my private tasks plus every family task.
- **Colors:**
  - Private = blue
  - Family = purple
  - Project = green (project lists use green regardless of visibility)
  - Done = gray
- A **Work** badge marks tasks with `context: "work"`.
- **Filters:** list, context (family/work), `for` (person or pet), assignee, priority, status, date range.
- **Sort:** priority, date, or dependency order (topological).
- **Today** is the start page (`#/`). It lists tasks that are in progress, scheduled or due today, or overdue, plus calendar events happening today. "Everything" is at `#/all`.
- Calendar events that are over are hidden by the default **Not done** filter; choose *Any status* to see them. Dates show the weekday, e.g. "Wed, Oct 7".

## 9. Chat Commands

The chat panel runs a local, rule-based parser. Dates are parsed by `chrono-node`. Replies can include quick-action buttons.

| Command | Example |
|---|---|
| Add task | `add task fertilize lawn on Oct 5 to Lawn project for work priority high` |
| Complete | `done fertilize lawn` |
| Move | `move fertilize lawn to Oct 8` (runs a forward shift preview) |
| Meet date | `shift dependencies so apply fertilizer is done by Oct 10` |
| Recalculate | `recalculate lawn` |
| Show | `show board weekend activities` / `show today` / `show work` |
| Vote | `vote 3 on tacos in restaurants` |
| Help | `help` |

- Task names are matched with fuzzy search. If a match is ambiguous, the reply asks the user to pick one.

## 10. UI

- **Desktop:**
  - TopBar: title, current view, avatar, quick add
  - Sidebar: private lists, family lists, projects, boards, combined view
  - MainPanel: the current view
  - RightPanel: task details, dependencies, schedule
  - Chat: a slide-over panel
- **Mobile:** a BottomNav with Home, My Tasks, Family, Voting and Chat. The sidebar collapses.
- **TaskCard:** title, priority badge, list or owner badge, Work badge, `for` chips, status, target date, dependency and conflict indicators, and quick actions (complete, edit, move).
- **Viewers** see the same screens, but editing controls are hidden.

### 10.1 Folder structure

```
src/
  components/{AppShell,Tasks,Dependencies,Voting,Chat,UI}/
  engine/        scheduling.ts, graph.ts (+ tests)
  chat/          parser.ts (+ tests)
  firebase/      config.ts, auth.ts, db.ts, converters/
  hooks/  context/  utils/  styles/
firestore.rules
firestore.indexes.json
```

## 11. Security Rules (outline)

- `isMember()` means `household/main.members[uid].role == "member"`. `isViewer()` means the role is `"viewer"`.
- **`household/main`:**
  - Members and viewers can read it.
  - Members can update `pets`, `weeklyTokens` and their own entry's display fields, but not roles.
  - Roles change only in the console.
- **`lists` and `tasks`:**
  - `visibility == "private"`: read and write only if `ownerId == uid`.
  - `visibility == "family"`: members can read and write. Viewers can read if `viewerVisible`.
- **`boards` and `items`:** members can read and write. Viewers can read if the board is `viewerVisible`.
- **`votes/{uid}`:**
  - Members can read them.
  - Users can write only the document whose ID is their own uid, and `tokens` must be a whole number of 0 or more.
- Everything else is denied.
- Queries must match the rules. For example, private tasks are queried with `where("ownerId","==",uid)` and `where("visibility","==","private")`.
- Rules are tested with the Firebase emulator.

## 12. Development and Deployment

- **Environment:** WSL Ubuntu 24.04, VS Code, Node LTS, GitHub (`stevenelson35/align`).
- **Firebase setup:**
  1. Create a project on the Spark plan.
  2. Enable Email/Password Auth and Firestore.
  3. Add authorized domains.
  4. Create user accounts.
  5. Seed `household/main`.
- **Local development:** `npm run dev` against the Firebase emulators (Auth and Firestore).
- **Tests:** Vitest for the engine and parser, and the rules test SDK for security rules.
- **Deploy the backend:** `firebase deploy --only firestore:rules,firestore:indexes`. Rules and indexes are free.
- **Deploy the frontend:** `npm run build`, then upload `dist/` to the Turbify subdomain's document root (FTP or File Manager). An `lftp` script can come later.

## 13. Status & Handoff

### Where things stand (2026-10-07)
- **Stage 1: scaffold (done).** Vite + React 19 + TypeScript, with Firebase wiring that uses the emulators in development, a sign-in-only screen, and a session provider.
- **Stage 2: security rules (done).** `firestore.rules` implements §11. There are now **20 rule tests**, including first-time household setup.
- **Stages 3–6: MVP (done, 2026-10-07, not yet committed or deployed):**
  - **Lists and tasks:** list/project CRUD (`ListEditor`; visibility changes batch-update the copied fields on tasks), task CRUD (`TaskDetails` right panel), and a combined view (`CombinedView`) with the §8 colors, filters and sorts (date, priority, dependency order). Views: Everything, Today, My tasks, Family tasks, Work, per-list. Hash routes are in `src/utils/routes.ts`.
  - **Scheduling engine:** `src/engine/` (`dates.ts`, `graph.ts`, `scheduling.ts`) handles earliest start, conflicts, forward shift, meet-date (backward) shift, recalculate and cycle rejection. Every shift opens a preview (`ShiftDialog`) and applies as one batch. `TimelineView` draws bars, `+Nd` arrows and conflict outlines, and dragging a bar previews a forward shift. Conflicts are computed live in `DataProvider`; the stored `conflict` field is refreshed whenever a shift is applied.
  - **Voting:** `src/voting/tokens.ts` handles the balance (weekly grant from `tokenStartDate`, rollover, chosen = spent, archived = returned). `BoardsView` offers a one-click "Add the starter boards". `BoardView` shows the ranking, per-member colored share bars, +/− voting with overspend blocking, chosen/archive/reopen, and a viewer-visible toggle.
  - **Chat:** `src/chat/parser.ts` (chrono-node dates) plus `src/chat/execute.ts`, which resolves names with `src/utils/fuzzy.ts` and asks with buttons when a match is ambiguous. It supports all §9 commands. "Quick add" opens chat pre-filled with `add task `.
  - **First-time setup:** when `household/main` doesn't exist, a signed-in user sees `Setup.tsx` and creates the household as its first member, optionally adding other members' uids and the pets. The rules allow `create` only while the document doesn't exist. Later role changes are still made in the console.
  - **Tests:** 29 unit tests (engine, tokens, parser, fuzzy). 2026-10-07: Playwright smoke runs against the emulators exercised sign-in, lists, chat add/done/move/meet/recalculate/show/vote, dependency conflicts, timeline drag, viewer visibility and mobile layout, with no console errors. Those scripts are throwaway and live outside the repo.
- **Deploy tooling:** `scripts/deploy-turbify.sh` (`npm run deploy:web`) uploads over explicit FTPS with lftp. It prompts for the password and only prunes inside `assets/`. `public/.htaccess` sets cache headers and forces HTTPS.
- **Deployed (2026-10-07):**
  - The Firebase project is `align-a32c1` (web app "Align Web App", owner steve.john.nelson@gmail.com). `.firebaserc` alias: `prod`.
  - Rules and indexes were deployed with `npm run deploy:rules`. The web config is in `.env.production.local` (gitignored).
  - The Turbify docroot is `/align.itsallonesong.com` (relative to the FTP login root), served by LiteSpeed with HTTPS.
  - The user created the household through the setup screen.

- **Google Calendar import (built 2026-10-07, not yet installed):**
  - §5.5 describes the design; `scripts/apps-script/` has the script, a least-privilege manifest and setup steps.
  - Rules now validate the optional `calendar` map on tasks: 21 rule tests.
  - Unit tests are in `tests/apps-script/` (37 unit tests total). `npm run test:calendar` runs the real script against the emulators, with fake Calendar, UrlFetch and Properties services.
  - The UI shows a 📅 time badge on imported tasks and a note in the task panel.

### Next stages
7. **First deploy (mostly done):** re-upload with `ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web` after each change. Confirm the permissions-race fix in production.
8. Polish ideas, in no particular order: code-split the Firebase SDK, a settings screen (weekly tokens, pets), recurring tasks (§3.2), and committing the Playwright smoke tests.

### What the user still has to do (can't be done by an agent)
0. **Calendar sync:** create the bot account, add it to `household/main.members` with `bot: true`, and install the Apps Script (`scripts/apps-script/README.md`). Also redeploy the rules (`npm run deploy:rules`) and the web app.
1. **Firebase console** (project `align`):
   - Authentication → Sign-in method → enable **Email/Password**.
   - Authentication → Settings → **User actions**: untick **Enable create (sign-up)**, so nobody can self-register with the public API key. Console-created accounts still work.
   - Authentication → Settings → Authorized domains: add `align.itsallonesong.com`.
   - Firestore Database → Create database (production mode; the region can't be changed later).
   - Authentication → Users: add the family's accounts. Copy each **User UID** for the setup screen.
   - Project settings → Your apps → Align Web App: copy `apiKey`, `authDomain`, `projectId` and `appId` into `.env.production.local` (see `.env.example`).
2. **CLI:** `firebase login --no-localhost` (interactive), then `firebase use --add` in the repo.
3. **Turbify:**
   - Create the subdomain `align.itsallonesong.com` in cPanel, with HTTPS (AutoSSL / Let's Encrypt).
   - Note its document root relative to the FTP login root; it's needed for `ALIGN_FTP_DIR`.
   - FTP facts (verified 2026-09-26 for psort): explicit FTPS to `cpanel292.turbify.biz` as `sjnelson@itsallonesong.com`. SFTP port 22 is closed. The FTP login starts at the main website root.
4. **Go live:** sign in at https://align.itsallonesong.com and fill in the one-time setup screen (household, members' uids, pets). Then open Voting → "Add the starter boards".

### Environment
- **WSL Ubuntu 24.04.** Node **v24.21.0** via nvm (`~/.nvm`); load it with `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- `firebase-tools` 15.31 is installed globally under nvm. Java 21 is present (for the emulators).
- **Emulator project ID:** `demo-align` ("demo-" projects never reach real Firebase). The emulator UI is at http://127.0.0.1:4000.
- **Test accounts** (password `align-dev`): `steve@`, `wife@`, `daughter@` (members) and `grandparent@` (viewer), all `@example.com`.

### Gotchas
- npm skipped the install scripts for `@firebase/util` and `protobufjs`. That's harmless: the stub `postinstall.mjs` ships with the package.
- `vite build` warns that the chunk is over 500 KB. It's the Firebase SDK, and code-splitting is optional.
- **First-time setup rule:** `household/main` allows `get` by any signed-in user and `create` only while it doesn't exist. That's why sign-up must be disabled in Auth settings before the household is created. After that, it's harmless.
- **The household listener ignores snapshots with `hasPendingWrites`.** Otherwise, right after first-time setup, the data queries could start before the server had the household; the rules would deny them, and the dead listeners left the app stuck on "Missing or insufficient permissions". This only showed up in production, because the emulator is too fast.
- **TaskDetails is re-keyed on the task's full JSON** so its form never keeps stale dates after a shift. Without this, Save would revert the shift.
- **Tasks copy their list's visibility fields**, so queries and rules need no lookups. The rules check them against the list with `getAfter()`, so a batch that changes a list and its tasks together is valid. Any code that changes a list's visibility or owner **must update its tasks in the same batch**.
- **Queries must match the rules.** Viewers must query family tasks with `where("viewerVisible","==",true)`.
- `firestore.indexes.json` declares the collection-group single-field index on `votes.uid` that the token-balance query needs.
- Don't put spaces in generated file or folder names (user preference). All pushes go over SSH.

